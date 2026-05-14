import { query } from './index';

async function seed() {
  console.log('Starting comprehensive seed...');

  try {
    // 1. Clear existing data (in reverse order of dependencies)
    await query('TRUNCATE TABLE "GanttTask", "AllocationEntry", "OngoingSnapshot", "Baseline", "ProjectPhase", "Project", "Resource", "User", "PhaseTemplate" CASCADE');

    // 2. Phase Templates (Default settings)
    await query(`
      INSERT INTO "PhaseTemplate" (name, display_name, "order", default_contingency_pct) VALUES
      ('feasibility',     'Feasibility',       1, 10),
      ('planning_design', 'Planning & Design', 2,  0),
      ('build',           'Build',             3,  0),
      ('deployment',      'Deployment',        4,  0),
      ('closure',         'Closure',           5,  0)
    `);

    // 3. Users (PMs and DM)
    const pm1Result = await query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Marco Rossi (PM)', 'marco@company.it', '$2b$10$SomethingSecret', 'pm']
    );
    const pm1Id = pm1Result.rows[0].id;

    const pm2Result = await query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Giulia PM', 'giulia@company.it', '$2b$10$SomethingSecret', 'pm']
    );
    const pm2Id = pm2Result.rows[0].id;

    await query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Andrea Delivery Manager', 'dm@company.it', '$2b$10$SomethingSecret', 'dm']
    );

    // 4. Resources (The Resource Registry)
    const resData = [
      ['Giuseppe Cerbero', 'Project Manager', 680],
      ['Vishal Patel', 'Senior Developer', 600],
      ['Vivekananda Rao', 'Business Analyst', 520],
      ['Elena Bianchi', 'UI/UX Designer', 450],
      ['Luca Verdi', 'DevOps Engineer', 550],
      ['Marta Neri', 'QA Tester', 400],
    ];

    const resources: any[] = [];
    for (const [name, role, rate] of resData) {
      const res = await query('INSERT INTO "Resource" (name, role, day_rate) VALUES ($1, $2, $3) RETURNING id', [name, role, rate]);
      resources.push({ id: res.rows[0].id, name, rate });
    }

    const r_pm = resources[0].id;
    const r_dev = resources[1].id;
    const r_ba = resources[2].id;
    const r_ui = resources[3].id;
    const r_ops = resources[4].id;
    const r_qa = resources[5].id;

    // 5. Projects
    const projectsData = [
      { name: 'RXI Platform Phase 2', pm_id: pm1Id, status: 'active', currency: 'GBP' },
      { name: 'PChallenges Portal', pm_id: pm1Id, status: 'active', currency: 'GBP' },
      { name: 'DataMesh Migration', pm_id: pm2Id, status: 'on_hold', currency: 'GBP' },
      { name: 'Legacy Cleanup', pm_id: pm2Id, status: 'closed', currency: 'GBP' },
    ];

    const projectIds: number[] = [];
    for (const p of projectsData) {
      const res = await query(
        'INSERT INTO "Project" (name, pm_id, status, currency) VALUES ($1, $2, $3, $4) RETURNING id',
        [p.name, p.pm_id, p.status, p.currency]
      );
      projectIds.push(res.rows[0].id);
    }

    const p_rxi = projectIds[0];
    const p_pchal = projectIds[1];
    const p_datamesh = projectIds[2];

    // 6. Phases for Projects
    const basePhases = [
      { type: 'feasibility',     order: 1, start: '2026-01-05', end: '2026-02-13', budget: 5000,  status: 'completed' },
      { type: 'planning_design', order: 2, start: '2026-02-16', end: '2026-03-27', budget: 15000, status: 'in_progress' },
      { type: 'build',           order: 3, start: '2026-03-30', end: '2026-08-14', budget: 85000, status: 'not_started' },
      { type: 'deployment',      order: 4, start: '2026-08-17', end: '2026-09-11', budget: 12000, status: 'not_started' },
      { type: 'closure',         order: 5, start: '2026-09-14', end: '2026-09-30', budget: 4000,  status: 'not_started' },
    ];

    const phaseMap: Record<number, number[]> = {};

    for (const pid of projectIds) {
      phaseMap[pid] = [];
      for (const ph of basePhases) {
        // Adjust dates slightly for different projects to avoid perfect alignment
        const offset = pid * 7;
        const start = new Date(new Date(ph.start).getTime() + offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = new Date(new Date(ph.end).getTime() + offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const res = await query(
          'INSERT INTO "ProjectPhase" (project_id, phase_type, display_name, "order", planned_start, planned_end, budget, status, contingency_pct) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
          [pid, ph.type, ph.type.charAt(0).toUpperCase() + ph.type.slice(1).replace('_', ' & '), ph.order, start, end, ph.budget, ph.status, ph.type === 'feasibility' ? 10 : 0]
        );
        phaseMap[pid].push(res.rows[0].id);
      }
    }

    // 7. Allocations (Including OVER-ALLOCATION for testing)
    // Vishal (r_dev) works on RXI and PChallenges in May 2026
    const may_weeks = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    
    for (const week of may_weeks) {
      // RXI: 0.6 FTE
      await query(
        'INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [r_dev, p_rxi, phaseMap[p_rxi][2], week, 0.6, 5, 1800]
      );
      // PChallenges: 0.5 FTE -> Total 1.1 FTE (WARNING!)
      await query(
        'INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [r_dev, p_pchal, phaseMap[p_pchal][2], week, 0.5, 5, 1500]
      );
    }

    // Normal allocations
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r_pm, p_rxi, phaseMap[p_rxi][1], '2026-02-16', 1.0, 5, 3400]);
    await query('INSERT INTO "AllocationEntry" (resource_id, project_id, phase_id, week_start, fte, working_days, weekly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [r_ui, p_rxi, phaseMap[p_rxi][1], '2026-02-16', 0.8, 5, 1800]);

    // 8. Baseline (Lock one project)
    await query(
      'INSERT INTO "Baseline" (project_id, contingency_pct, locked_at, total_budget_at_lock, total_forecast_at_lock, total_working_days_at_lock) VALUES ($1, $2, $3, $4, $5, $6)',
      [p_rxi, 5, '2026-02-01T10:00:00Z', 120000, 126000, 140]
    );

    // 9. Ongoing Snapshots
    await query(
      'INSERT INTO "OngoingSnapshot" (project_id, reporting_date, hours_spent_to_date, cost_spent_to_date, working_days_used, working_days_remaining, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [p_rxi, '2026-05-14', 480, 52000, 65, 75, 'manual']
    );

    // 10. Gantt Tasks and Milestones
    // RXI Tasks
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, actual_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [p_rxi, phaseMap[p_rxi][0], 'Requirement Gathering', 'Vivek', '2026-01-05', '2026-01-23', 15, false, null, 'completed']
    );
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, actual_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [p_rxi, phaseMap[p_rxi][0], '◆ Feasibility Approval', null, '2026-02-13', '2026-02-13', 1, true, '2026-02-12', 'completed']
    );
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [p_rxi, phaseMap[p_rxi][1], 'Architecture Design', 'Vishal', '2026-02-16', '2026-03-10', 17, false, 'completed']
    );
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [p_rxi, phaseMap[p_rxi][1], 'UI Mockups', 'Elena', '2026-03-02', '2026-03-27', 20, false, 'in_progress']
    );
    await query(
      'INSERT INTO "GanttTask" (project_id, phase_id, name, owner, start_date, end_date, working_days, is_milestone, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [p_rxi, phaseMap[p_rxi][1], '◆ Design Sign-off', null, '2026-03-27', '2026-03-27', 1, true, 'not_started']
    );

    console.log('Comprehensive seed completed successfully!');
  } catch (err) {
    console.error('Error during seed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
