/**
 * Router({ mergeParams: true }) mounted under /api/projects/:id. Surfaces the
 * Estimate Intelligence endpoints (semantic similarity, and — in later
 * milestones — scoping-insight and retro-questions). Inherits
 * requireAuth + requireProjectAccess from the prefix mount in index.ts (DL-002);
 * no duplicate middleware. Every handler derives its vectors/context from the
 * project :id in scope, never from client-supplied data.
 */
import { Router } from 'express';
import { query } from '../db';
import { getIntelligenceProvider } from '../services/intelligence/intelligenceService';
import type { ProjectKGContext, RetroContext } from '../services/intelligence/IntelligenceProvider';
import { computeProjectFinancials } from '../services/phaseFinancialEngine';

const router = Router({ mergeParams: true });

// pgvector-absent error codes: undefined column/operator/type/table. When the
// pgvector extension (mig 013) is not installed on the server the column,
// operator (<=>) or vector type does not exist and the query throws one of
// these. We then degrade to an empty list — the tag-overlap route /similar
// stays the always-available fallback — instead of surfacing infra errors.
const PGVECTOR_ABSENT_CODES = new Set(['42703', '42883', '42704', '42P01']);

const toKGContext = (r: any): ProjectKGContext => ({
  id: r.id,
  name: r.name,
  description: r.description ?? null,
  tags: r.tags ?? [],
});

// Build the "similar history" for a project: semantic kNN neighbours when
// embeddings exist, otherwise tag-overlap. Degrades to tag fallback (never
// throws) when pgvector is absent, so scoping insight works without embeddings.
async function fetchSimilarContext(id: number, tags: string[]): Promise<ProjectKGContext[]> {
  try {
    const tgt = await query(`SELECT description_embedding FROM "Project" WHERE id = $1`, [id]);
    const embedding = tgt.rows[0]?.description_embedding ?? null;
    if (embedding != null) {
      const r = await query(
        `SELECT id, name, description, tags
         FROM "Project"
         WHERE id != $2 AND description_embedding IS NOT NULL
         ORDER BY description_embedding <=> $1::vector
         LIMIT 5`,
        [embedding, id]
      );
      if (r.rowCount) return r.rows.map(toKGContext);
    }
  } catch (err: any) {
    if (!(err && PGVECTOR_ABSENT_CODES.has(err.code))) throw err;
    // pgvector absent → fall through to tag-overlap fallback
  }

  if (tags.length === 0) return [];
  const r = await query(
    `SELECT id, name, description, tags
     FROM "Project"
     WHERE id != $2 AND tags ?| $1::text[]
     ORDER BY (SELECT count(*) FROM jsonb_array_elements_text(tags) t WHERE t = ANY($1::text[])) DESC
     LIMIT 5`,
    [tags, id]
  );
  return r.rows.map(toKGContext);
}

// GET /api/projects/:id/similar-semantic
// Returns up to 5 projects ordered by cosine distance on the :id project's
// description_embedding. Returns [] when the project has no embedding (or
// pgvector is absent) so the UI falls back to tag-overlap results. (DL-001)
router.get('/similar-semantic', async (req, res) => {
  const { id: rawId } = req.params as { id: string };
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const target = await query(
      `SELECT description_embedding FROM "Project" WHERE id = $1`,
      [id]
    );
    const embedding = target.rows[0]?.description_embedding ?? null;
    if (!target.rowCount || embedding == null) {
      return res.json([]);
    }

    const result = await query(
      `SELECT id, name, status, tags, description,
              (1 - (description_embedding <=> $1::vector))::float AS similarity
       FROM "Project"
       WHERE id != $2
         AND description_embedding IS NOT NULL
       ORDER BY description_embedding <=> $1::vector
       LIMIT 5`,
      [embedding, id]
    );

    res.json(result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      tags: r.tags ?? [],
      description: r.description ?? null,
      similarity: r.similarity != null ? Number(r.similarity) : null,
    })));
  } catch (err: any) {
    if (err && PGVECTOR_ABSENT_CODES.has(err.code)) {
      return res.json([]);
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/scoping-insight
// Composes real similarHistory (semantic neighbours, tag fallback) and asks the
// IntelligenceProvider for a risk brief. Graceful by construction:
//  - no ANTHROPIC_API_KEY → NoOpProvider returns '' (no error, no Claude call)
//  - <3 similar projects (cold start) → ClaudeProvider returns '' (DL-003, R-002)
//  - pgvector absent → fetchSimilarContext falls back to tags, never throws
// The frontend renders a placeholder when brief is empty. (DL-002, DL-003)
router.get('/scoping-insight', async (req, res) => {
  const { id: rawId } = req.params as { id: string };
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const projRes = await query(
      `SELECT id, name, description, tags FROM "Project" WHERE id = $1`,
      [id]
    );
    if (!projRes.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = toKGContext(projRes.rows[0]);

    const similarHistory = await fetchSimilarContext(id, project.tags);
    const brief = await getIntelligenceProvider().summarizeScopingRisks(project, similarHistory);

    res.json({ brief, similar_count: similarHistory.length });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/retro-questions
// Computes a RetroContext from existing data (SlippageEvent counts + budget
// variance / delayed phases from phaseFinancialEngine) and asks the
// IntelligenceProvider for tailored retro questions. Graceful by construction:
//  - no ANTHROPIC_API_KEY → NoOpProvider returns [] (no Claude call)
//  - no signal (0 slippage and 0 variance) → ClaudeProvider returns [] (DL-004)
//  - frontend falls back to its static question set when [] is returned
router.get('/retro-questions', async (req, res) => {
  const { id: rawId } = req.params as { id: string };
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const projRes = await query(
      `SELECT id, name, description, tags FROM "Project" WHERE id = $1`,
      [id]
    );
    if (!projRes.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = toKGContext(projRes.rows[0]);

    const slipRes = await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE expected = false)::int AS unexpected
       FROM "SlippageEvent"
       WHERE project_id = $1`,
      [id]
    );
    const rollup = await computeProjectFinancials(id);

    const observed: RetroContext = {
      slippage_count: slipRes.rows[0]?.total ?? 0,
      unexpected_slippage_count: slipRes.rows[0]?.unexpected ?? 0,
      budget_variance: rollup.total_variance,
      phases_delayed: rollup.phases.filter((p) => p.variance > 0).length,
    };

    const questions = await getIntelligenceProvider().generateRetroQuestions(project, observed);
    res.json({ questions });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
