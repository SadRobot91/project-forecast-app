import { Router } from 'express';
import { query } from '../db';
import { getIntelligenceProvider } from '../services/intelligence/intelligenceService';
import { upsertProjectEmbedding } from '../services/embeddings/embeddingService';

const router = Router({ mergeParams: true });

const VALID_RISK_CATEGORIES = ['Budget', 'Timeline', 'Resource', 'Scope'] as const;
type RiskCategory = typeof VALID_RISK_CATEGORIES[number];

// ─── PATCH / (update description / tags of project :id) ──────────────────────

router.patch('/', async (req, res) => {
  const { id } = req.params as { id: string };
  const { description, tags } = req.body as { description?: string; tags?: string[] };

  if (description === undefined && tags === undefined) {
    return res.status(400).json({ error: 'At least one of description or tags must be provided' });
  }

  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(description);
    }
    if (tags !== undefined) {
      setClauses.push(`tags = $${idx++}::jsonb`);
      values.push(JSON.stringify(tags));
    }

    values.push(id);
    const result = await query(
      `UPDATE "Project" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, name, description, tags`,
      values
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    // Update semantic embedding when description changes (fire & forget)
    if (description !== undefined) {
      void upsertProjectEmbedding(parseInt(id, 10), description).catch(() => {});
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── POST /decisions ──────────────────────────────────────────────────────────

router.post('/decisions', async (req, res) => {
  const { id } = req.params as { id: string };
  const { title, rationale, expected_consequence, phase_id, decided_at } = req.body as {
    title?: string;
    rationale?: string;
    expected_consequence?: string;
    phase_id?: number;
    decided_at?: string;
  };

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }

  try {
    const projectCheck = await query(`SELECT 1 FROM "Project" WHERE id = $1`, [id]);
    if (!projectCheck.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `INSERT INTO "Decision" (project_id, title, rationale, expected_consequence, phase_id, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, title.trim(), rationale ?? null, expected_consequence ?? null, phase_id ?? null, decided_at ?? null]
    );
    // Fire-and-forget stub: wires the call path but similarHistory is empty until
    // a real query for similar projects is plumbed in here. Cold-start guard in
    // ClaudeProvider (<3 projects) ensures this is a safe no-op for now.
    void (async () => {
      try {
        const provider = getIntelligenceProvider();
        await provider.summarizeScopingRisks(
          { id: parseInt(id, 10), name: '', description: null, tags: [] },
          []
        );
      } catch {
        // best-effort, never fails the request
      }
    })();
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /decisions ───────────────────────────────────────────────────────────

router.get('/decisions', async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const result = await query(
      `SELECT * FROM "Decision" WHERE project_id = $1 ORDER BY decided_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── POST /risks ──────────────────────────────────────────────────────────────

router.post('/risks', async (req, res) => {
  const { id } = req.params as { id: string };
  const { description, category, decision_id } = req.body as {
    description?: string;
    category?: string;
    decision_id?: number;
  };

  if (!description || typeof description !== 'string' || description.trim() === '') {
    return res.status(400).json({ error: 'description is required and must be a non-empty string' });
  }

  if (category !== undefined && !VALID_RISK_CATEGORIES.includes(category as RiskCategory)) {
    return res.status(400).json({
      error: `category must be one of: ${VALID_RISK_CATEGORIES.join(', ')}`,
    });
  }

  try {
    const projectCheck = await query(`SELECT 1 FROM "Project" WHERE id = $1`, [id]);
    if (!projectCheck.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `INSERT INTO "Risk" (project_id, description, category, decision_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, description.trim(), category ?? null, decision_id ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /risks ───────────────────────────────────────────────────────────────

router.get('/risks', async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const result = await query(
      `SELECT r.*, d.title as decision_title
         FROM "Risk" r
         LEFT JOIN "Decision" d ON d.id = r.decision_id
        WHERE r.project_id = $1
        ORDER BY r.identified_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── POST /slippage ───────────────────────────────────────────────────────────

router.post('/slippage', async (req, res) => {
  const { id } = req.params as { id: string };
  const { expected, cause, phase_id } = req.body as {
    expected?: boolean;
    cause?: string;
    phase_id?: number;
  };

  if (expected === undefined || expected === null || typeof expected !== 'boolean') {
    return res.status(400).json({ error: 'expected is required and must be true or false' });
  }

  try {
    const projectCheck = await query(`SELECT 1 FROM "Project" WHERE id = $1`, [id]);
    if (!projectCheck.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `INSERT INTO "SlippageEvent" (project_id, phase_id, expected, cause)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, phase_id ?? null, expected, cause ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /slippage ────────────────────────────────────────────────────────────

router.get('/slippage', async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const result = await query(
      `SELECT * FROM "SlippageEvent" WHERE project_id = $1 ORDER BY recorded_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── POST /retrospectives ─────────────────────────────────────────────────────

router.post('/retrospectives', async (req, res) => {
  const { id } = req.params as { id: string };
  const { answer, question, phase_id } = req.body as {
    answer?: string;
    question?: string;
    phase_id?: number;
  };

  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    return res.status(400).json({ error: 'answer is required and must be a non-empty string' });
  }

  try {
    const projectCheck = await query(`SELECT 1 FROM "Project" WHERE id = $1`, [id]);
    if (!projectCheck.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await query(
      `INSERT INTO "Retrospective" (project_id, phase_id, question, answer)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, phase_id ?? null, question ?? null, answer.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /retrospectives ──────────────────────────────────────────────────────

router.get('/retrospectives', async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const result = await query(
      `SELECT * FROM "Retrospective" WHERE project_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
