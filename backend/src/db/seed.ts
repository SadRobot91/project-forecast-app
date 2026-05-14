import { query } from './index';

async function seed() {
  console.log('Starting seed...');

  try {
    // 1. Clear existing data (in reverse order of dependencies)
    await query('TRUNCATE TABLE "GanttTask", "AllocationEntry", "OngoingSnapshot", "Baseline", "ProjectPhase", "Project", "Resource", "User" CASCADE');

    // 2. Users
    const pmUser = await query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Giuseppe PM', 'giuseppe@company.com', '$2b$10$SomethingSecret', 'pm']
    );
    const pmId = pmUser.rows[0].id;

    await query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Delivery Manager', 'dm@company.com', '$2b$10$SomethingSecret', 'dm']
    );

    // 3. Resources
    const res1 = await query('INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING id', ['Giuseppe Cerbero', 'Project Manager', 680]);
    const res2 = await query('INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING id', ['Vishal Patel', 'Senior Developer', 600]);
    const res3 = await query('INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING id', ['Vivekananda Rao', 'Business Analyst', 520]);

    const r1 = res1.rows[0].id;
    const r2 = res2.rows[0].id;
    const r3 = res3.rows[0].id;

    // 4. Projects
    const p1 = await query(
      'INSERT INTO "Project" (name, pm_id, status, currency) VALUES ($1, $2, $3, $4) RETURNING id',
      ['RXI Platform', pmId, 'active', 'GBP']
    );
    const p2 = await query(
      'INSERT INTO "Project" (name, pm_id, status, currency) VALUES ($1, $2, $3, $4) RETURNING id',
      ['PChallenges Portal', pmId, 'active', 'GBP']
    );
    const p3 = await query(
      'INSERT INTO "Project" (name, pm_id, status, currency) VALUES ($1, $2, $3, $4) RETURNING id',
      ['DataMesh Migration', pmId, 'closed', 'GBP']
    );

    const projectId1 = p1.rows[0].id;
    const projectId2 = p2.rows[0].id;
    const projectId3 = p3.rows[0].id;

    // 5. Phases for RXI Platform
    const phasesData = [
      { type: 'feasibility',     order: 1, start: '2026-01-05', end: '2026-01-20', budget: 4080,  status: 'completed' },
      { type: 'planning_design', order: 2, start: '2026-01-21', end: '2026-02-27', budget: 12320, status: 'completed' },
      { type: 'build',           order: 3, start: '2026-03-02', end: '2026-06-19', budget: 41600, status: 'in_progress' },
      { type: 'deployment',      order: 4, start: '2026-06-22', end: '2026-07-10', budget: 6000,  status: 'not_started' },
      { type: 'closure',         order: 5, start: '2026-07-13', end: '2026-07-22', budget: 2600,  status: 'not_started' },
    ];

    const phaseIds1: number[] = [];
    for (const ph of phasesData) {
      const res = await query(
        'INSERT INTO "ProjectPhase" (project_id, phase_type, "order", planned_start, planned_end, budget, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [projectId1, ph.type, ph.order, ph.start, ph.end, ph.budget, ph.status]
      );
      phaseIds1.push(res.rows[0].id);
    }

    // 6. Allocations for RXI Platform (Mocking some entries)
    // Feasibility entries
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r1, projectId1, phaseIds1[0], '2026-01-05', 0.5, 5, 1700]);
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r1, projectId1, phaseIds1[0], '2026-01-12', 0.5, 5, 1700]);
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r3, projectId1, phaseIds1[0], '2026-01-05', 0.2, 5, 520]);

    // Build entries
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r2, projectId1, phaseIds1[2], '2026-03-02', 0.8, 5, 2400]);
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r2, projectId1, phaseIds1[2], '2026-04-06', 0.8, 5, 2400]);

    // 7. Ongoing Snapshots for RXI Platform
    await query(
      'INSERT INTO "OngoingSnapshot" (project_id, reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [projectId1, '2026-04-30', 320, 36200, 58, 83, 'manual']
    );

    // 8. Gantt Tasks for RXI Platform
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, actual_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [projectId1, phaseIds1[0], 'Stakeholder interviews', 'Giuseppe', '2026-01-05', '2026-01-12', 6, false, null, 'completed']
    );
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, actual_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [projectId1, phaseIds1[0], 'Feasibility Sign-off', null, '2026-01-20', '2026-01-20', 1, true, '2026-01-22', 'completed']
    );

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Error during seed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
