import type {
  AuthResponse, DashboardData, ProjectSummary,
  BaselineData, AllocationData, ResourceRegistryData, GanttData,
  OngoingData, OngoingSnapshot,
} from '../types';

// ─────────────────────────────────────────────
// Realistic mock data for local development
// Activated when VITE_USE_MOCK=true in .env.local
// ─────────────────────────────────────────────

export const MOCK_TOKEN = 'mock-jwt-token-dev';

export const MOCK_AUTH: AuthResponse = {
  token: MOCK_TOKEN,
  user: {
    id: 1,
    name: 'Giuseppe Cerbero',
    email: 'giuseppe@company.com',
    role: 'pm',
  },
};

export const MOCK_PROJECTS: ProjectSummary[] = [
  {
    id: 1,
    name: 'RXI Platform',
    status: 'active',
    rag_status: 'A_RISCHIO',
    current_phase: 'build',
    current_phase_display_name: 'Build',
    budget_total: 64600,
    budget_spent: 36200,
    budget_pct: 56,
    days_remaining: 48,
    currency: 'GBP',
  },
  {
    id: 2,
    name: 'PChallenges Portal',
    status: 'active',
    rag_status: 'IN_LINEA',
    current_phase: 'planning_design',
    current_phase_display_name: 'Planning & Design',
    budget_total: 42000,
    budget_spent: 8400,
    budget_pct: 20,
    days_remaining: 112,
    currency: 'GBP',
  },
  {
    id: 3,
    name: 'DataMesh Migration',
    status: 'closed',
    rag_status: 'FUORI_BUDGET',
    current_phase: 'closure',
    current_phase_display_name: 'Closure',
    budget_total: 95000,
    budget_spent: 112300,
    budget_pct: 118,
    days_remaining: 0,
    currency: 'GBP',
  },
];

export const MOCK_DASHBOARD: DashboardData = {
  project_id: 1,
  project_name: 'RXI Platform',
  kpis: {
    cost_spent: 36200,
    budget_total: 64600,
    revised_forecast: 69800,
    daily_burn_rate: 520,
    variance: 5200,
    days_remaining: 48,
    budget_pct: 56,
    rag_status: 'A_RISCHIO',
    last_sync_at: '2026-05-09T18:30:00Z',
    last_sync_source: 'manual',
    hours_spent_to_date: 320,
    working_days_used: 58,
  },
  phase_budgets: [
    { phase_id: 1, phase_type: 'feasibility',     display_name: 'Feasibility',       planned_start: '2026-01-05', planned_end: '2026-01-20', working_days: 12, planned_hours: 96,  burn_rate_per_day: 340, budget: 4080,  budget_pct_of_total: 6.3 },
    { phase_id: 2, phase_type: 'planning_design', display_name: 'Planning & Design', planned_start: '2026-01-21', planned_end: '2026-02-27', working_days: 28, planned_hours: 224, burn_rate_per_day: 440, budget: 12320, budget_pct_of_total: 19.1 },
    { phase_id: 3, phase_type: 'build',           display_name: 'Build',             planned_start: '2026-03-02', planned_end: '2026-06-19', working_days: 80, planned_hours: 640, burn_rate_per_day: 520, budget: 41600, budget_pct_of_total: 64.4 },
    { phase_id: 4, phase_type: 'deployment',      display_name: 'Deployment',        planned_start: '2026-06-22', planned_end: '2026-07-10', working_days: 15, planned_hours: 120, burn_rate_per_day: 400, budget: 6000,  budget_pct_of_total: 9.3 },
    { phase_id: 5, phase_type: 'closure',         display_name: 'Closure',           planned_start: '2026-07-13', planned_end: '2026-07-22', working_days: 8,  planned_hours: 64,  burn_rate_per_day: 325, budget: 2600,  budget_pct_of_total: 4.0 },
  ],
  milestones: [
    { id: 1, name: 'Feasibility Sign-off', planned_date: '2026-01-20', actual_date: '2026-01-22', status: 'completed',   is_milestone: true },
    { id: 2, name: 'Design Approved',      planned_date: '2026-02-27', actual_date: '2026-03-01', status: 'completed',   is_milestone: true },
    { id: 3, name: 'Alpha Build Ready',    planned_date: '2026-04-30', actual_date: null,          status: 'completed',   is_milestone: true },
    { id: 4, name: 'UAT Complete',         planned_date: '2026-06-12', actual_date: null,          status: 'in_progress', is_milestone: true },
    { id: 5, name: 'Go Live',             planned_date: '2026-07-10', actual_date: null,          status: 'not_started', is_milestone: true },
  ],
  phase_financials: [],
};

// ─── Baseline ────────────────────────────────

export const MOCK_BASELINE: BaselineData = {
  project_id: 1,
  project_name: 'RXI Platform',
  is_locked: false,
  locked_at: null,
  total_budget: 66600,
  total_forecast: 67008,
  phases: [
    { phase_id: 1, phase_type: 'feasibility',     display_name: 'Feasibility',       order: 1, planned_start: '2026-01-05', planned_end: '2026-01-20', working_days: 12, planned_hours: 96,  budget: 4080,  contingency_pct: 10, status: 'completed',   is_locked: false },
    { phase_id: 2, phase_type: 'planning_design', display_name: 'Planning & Design', order: 2, planned_start: '2026-01-21', planned_end: '2026-02-27', working_days: 28, planned_hours: 224, budget: 12320, contingency_pct: 0,  status: 'completed',   is_locked: false },
    { phase_id: 3, phase_type: 'build',           display_name: 'Build',             order: 3, planned_start: '2026-03-02', planned_end: '2026-06-19', working_days: 80, planned_hours: 640, budget: 41600, contingency_pct: 0,  status: 'in_progress', is_locked: false },
    { phase_id: 4, phase_type: 'deployment',      display_name: 'Deployment',        order: 4, planned_start: '2026-06-22', planned_end: '2026-07-10', working_days: 15, planned_hours: 120, budget: 6000,  contingency_pct: 0,  status: 'not_started', is_locked: false },
    { phase_id: 5, phase_type: 'closure',         display_name: 'Closure',           order: 5, planned_start: '2026-07-13', planned_end: '2026-07-22', working_days: 8,  planned_hours: 64,  budget: 2600,  contingency_pct: 0,  status: 'not_started', is_locked: false },
  ],
};

// ─── Allocation ───────────────────────────────

const MOCK_RESOURCES_LIST = [
  { id: 1, name: 'Giuseppe Cerbero', role: 'Project Manager',  day_rate: 680 },
  { id: 2, name: 'Vishal Patel',     role: 'Senior Developer', day_rate: 600 },
  { id: 3, name: 'Vivekananda Rao',  role: 'Business Analyst', day_rate: 520 },
];

export const MOCK_ALLOCATION: AllocationData = {
  project_id: 1,
  project_name: 'RXI Platform',
  all_resources: MOCK_RESOURCES_LIST,
  phases: [
    {
      phase_id: 1, phase_type: 'feasibility', display_name: 'Feasibility', planned_start: '2026-01-05', planned_end: '2026-01-20',
      resources: [MOCK_RESOURCES_LIST[0], MOCK_RESOURCES_LIST[2]],
      phase_budget: 4080, avg_fte: 0.35, burn_rate_per_day: 340,
      cells: [
        { resource_id: 1, phase_id: 1, week_start: '2026-01-05', fte: 0.5, working_days: 5, weekly_cost: 1700 },
        { resource_id: 1, phase_id: 1, week_start: '2026-01-12', fte: 0.5, working_days: 5, weekly_cost: 1700 },
        { resource_id: 1, phase_id: 1, week_start: '2026-01-19', fte: 0.5, working_days: 2, weekly_cost: 680  },
        { resource_id: 3, phase_id: 1, week_start: '2026-01-05', fte: 0.2, working_days: 5, weekly_cost: 520  },
        { resource_id: 3, phase_id: 1, week_start: '2026-01-12', fte: 0.2, working_days: 5, weekly_cost: 520  },
        { resource_id: 3, phase_id: 1, week_start: '2026-01-19', fte: 0.2, working_days: 2, weekly_cost: 208  },
      ],
    },
    {
      phase_id: 2, phase_type: 'planning_design', display_name: 'Planning & Design', planned_start: '2026-01-21', planned_end: '2026-02-27',
      resources: MOCK_RESOURCES_LIST,
      phase_budget: 12320, avg_fte: 0.47, burn_rate_per_day: 440,
      cells: [
        { resource_id: 1, phase_id: 2, week_start: '2026-01-26', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 2, week_start: '2026-02-02', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 2, week_start: '2026-02-09', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 2, week_start: '2026-02-16', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 2, week_start: '2026-02-23', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 2, phase_id: 2, week_start: '2026-01-26', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 2, week_start: '2026-02-02', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 2, week_start: '2026-02-09', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 2, week_start: '2026-02-16', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 2, week_start: '2026-02-23', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 3, phase_id: 2, week_start: '2026-01-26', fte: 0.3, working_days: 5, weekly_cost: 780  },
        { resource_id: 3, phase_id: 2, week_start: '2026-02-02', fte: 0.3, working_days: 5, weekly_cost: 780  },
        { resource_id: 3, phase_id: 2, week_start: '2026-02-09', fte: 0.3, working_days: 5, weekly_cost: 780  },
        { resource_id: 3, phase_id: 2, week_start: '2026-02-16', fte: 0.3, working_days: 5, weekly_cost: 780  },
        { resource_id: 3, phase_id: 2, week_start: '2026-02-23', fte: 0.3, working_days: 5, weekly_cost: 780  },
      ],
    },
    {
      phase_id: 3, phase_type: 'build', display_name: 'Build', planned_start: '2026-03-02', planned_end: '2026-06-19',
      resources: [MOCK_RESOURCES_LIST[0], MOCK_RESOURCES_LIST[1]],
      phase_budget: 41600, avg_fte: 0.65, burn_rate_per_day: 520,
      cells: [
        { resource_id: 1, phase_id: 3, week_start: '2026-03-02', fte: 0.3, working_days: 5, weekly_cost: 1020 },
        { resource_id: 1, phase_id: 3, week_start: '2026-04-06', fte: 0.3, working_days: 5, weekly_cost: 1020 },
        { resource_id: 1, phase_id: 3, week_start: '2026-05-04', fte: 0.3, working_days: 5, weekly_cost: 1020 },
        { resource_id: 1, phase_id: 3, week_start: '2026-06-01', fte: 0.3, working_days: 5, weekly_cost: 1020 },
        { resource_id: 2, phase_id: 3, week_start: '2026-03-02', fte: 0.8, working_days: 5, weekly_cost: 2400 },
        { resource_id: 2, phase_id: 3, week_start: '2026-04-06', fte: 0.8, working_days: 5, weekly_cost: 2400 },
        { resource_id: 2, phase_id: 3, week_start: '2026-05-04', fte: 0.8, working_days: 5, weekly_cost: 2400 },
        { resource_id: 2, phase_id: 3, week_start: '2026-06-01', fte: 0.8, working_days: 5, weekly_cost: 2400 },
      ],
    },
    {
      phase_id: 4, phase_type: 'deployment', display_name: 'Deployment', planned_start: '2026-06-22', planned_end: '2026-07-10',
      resources: MOCK_RESOURCES_LIST,
      phase_budget: 6000, avg_fte: 0.4, burn_rate_per_day: 400,
      cells: [
        { resource_id: 1, phase_id: 4, week_start: '2026-06-22', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 4, week_start: '2026-06-29', fte: 0.2, working_days: 5, weekly_cost: 680  },
        { resource_id: 1, phase_id: 4, week_start: '2026-07-06', fte: 0.2, working_days: 4, weekly_cost: 544  },
        { resource_id: 2, phase_id: 4, week_start: '2026-06-22', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 4, week_start: '2026-06-29', fte: 0.5, working_days: 5, weekly_cost: 1500 },
        { resource_id: 2, phase_id: 4, week_start: '2026-07-06', fte: 0.5, working_days: 4, weekly_cost: 1200 },
      ],
    },
    {
      phase_id: 5, phase_type: 'closure', display_name: 'Closure', planned_start: '2026-07-13', planned_end: '2026-07-22',
      resources: [MOCK_RESOURCES_LIST[0]],
      phase_budget: 2600, avg_fte: 0.5, burn_rate_per_day: 325,
      cells: [
        { resource_id: 1, phase_id: 5, week_start: '2026-07-13', fte: 0.5, working_days: 5, weekly_cost: 1700 },
        { resource_id: 1, phase_id: 5, week_start: '2026-07-20', fte: 0.5, working_days: 3, weekly_cost: 1020 },
      ],
    },
  ],
};

// ─── Resource Registry ────────────────────────

export const MOCK_RESOURCE_REGISTRY: ResourceRegistryData = {
  weeks: [
    '2025-10-06', '2025-11-03', '2025-12-01',
    '2026-01-05', '2026-01-12', '2026-01-19',
    '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
    '2026-03-02', '2026-04-06', '2026-05-04',
    '2026-06-01', '2026-06-22', '2026-06-29',
    '2026-07-06', '2026-07-13', '2026-07-20',
  ],
  has_overallocation: true,
  rows: [
    {
      resource: MOCK_RESOURCES_LIST[0],
      allocations: [
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-01-05', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-01-12', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-01-19', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-01-26', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-02-02', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-02-09', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-02-16', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-02-23', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-03-02', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-04-06', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-05-04', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-06-01', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-06-22', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-06-29', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-07-06', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-07-13', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform', project_status: 'active', week_start: '2026-07-20', fte: 0.5 },
      ],
      totals: {
        '2026-01-05': 0.5, '2026-01-12': 0.5, '2026-01-19': 0.5,
        '2026-01-26': 0.2, '2026-02-02': 0.2, '2026-02-09': 0.2, '2026-02-16': 0.2, '2026-02-23': 0.2,
        '2026-03-02': 0.3, '2026-04-06': 0.3, '2026-05-04': 0.3,
        '2026-06-01': 0.3, '2026-06-22': 0.2, '2026-06-29': 0.2,
        '2026-07-06': 0.2, '2026-07-13': 0.5, '2026-07-20': 0.5,
      },
    },
    {
      resource: MOCK_RESOURCES_LIST[1],
      allocations: [
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-01-26', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-02-02', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-02-09', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-02-16', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-02-23', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-03-02', fte: 0.8 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-04-06', fte: 0.8 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-05-04', fte: 0.8 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-06-01', fte: 0.8 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-06-22', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-06-29', fte: 0.5 },
        { project_id: 1, project_name: 'RXI Platform',       project_status: 'active', week_start: '2026-07-06', fte: 0.5 },
        { project_id: 2, project_name: 'PChallenges Portal', project_status: 'active', week_start: '2026-06-01', fte: 0.5 }, // overallocation!
      ],
      totals: {
        '2026-01-26': 0.5, '2026-02-02': 0.5, '2026-02-09': 0.5, '2026-02-16': 0.5, '2026-02-23': 0.5,
        '2026-03-02': 0.8, '2026-04-06': 0.8, '2026-05-04': 0.8,
        '2026-06-01': 1.3, '2026-06-22': 0.5, '2026-06-29': 0.5,
        '2026-07-06': 0.5,
      },
    },
    {
      resource: MOCK_RESOURCES_LIST[2],
      allocations: [
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-01-05', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-01-12', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-01-19', fte: 0.2 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-01-26', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-02-02', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-02-09', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-02-16', fte: 0.3 },
        { project_id: 1, project_name: 'RXI Platform',     project_status: 'active', week_start: '2026-02-23', fte: 0.3 },
        { project_id: 3, project_name: 'DataMesh Migration', project_status: 'closed', week_start: '2025-10-06', fte: 0.5 },
        { project_id: 3, project_name: 'DataMesh Migration', project_status: 'closed', week_start: '2025-11-03', fte: 0.5 },
        { project_id: 3, project_name: 'DataMesh Migration', project_status: 'closed', week_start: '2025-12-01', fte: 0.3 },
      ],
      totals: {
        '2026-01-05': 0.2, '2026-01-12': 0.2, '2026-01-19': 0.2,
        '2026-01-26': 0.3, '2026-02-02': 0.3, '2026-02-09': 0.3, '2026-02-16': 0.3, '2026-02-23': 0.3,
        '2025-10-06': 0.5, '2025-11-03': 0.5, '2025-12-01': 0.3,
      },
    },
  ],
};

// ─── Gantt ────────────────────────────────────

export const MOCK_GANTT: GanttData = {
  project_id: 1,
  project_name: 'RXI Platform',
  project_start: '2026-01-05',
  project_end: '2026-07-22',
  phases: [
    {
      phase_id: 1, phase_type: 'feasibility', display_name: 'Feasibility',
      planned_start: '2026-01-05', planned_end: '2026-01-20', status: 'completed',
      tasks: [
        { id: 1, project_id: 1, phase_id: 1, phase_type: 'feasibility', name: 'Stakeholder interviews', owner: 'Giuseppe', start_date: '2026-01-05', end_date: '2026-01-12', working_days: 6, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 2, project_id: 1, phase_id: 1, phase_type: 'feasibility', name: 'Feasibility report', owner: 'Giuseppe', start_date: '2026-01-13', end_date: '2026-01-19', working_days: 5, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 3, project_id: 1, phase_id: 1, phase_type: 'feasibility', name: 'Feasibility Sign-off', owner: null, start_date: '2026-01-20', end_date: '2026-01-20', working_days: 1, is_milestone: true, actual_date: '2026-01-22', status: 'completed' },
      ],
    },
    {
      phase_id: 2, phase_type: 'planning_design', display_name: 'Planning & Design',
      planned_start: '2026-01-21', planned_end: '2026-02-27', status: 'completed',
      tasks: [
        { id: 4, project_id: 1, phase_id: 2, phase_type: 'planning_design', name: 'Requirements gathering', owner: 'Vivekananda', start_date: '2026-01-21', end_date: '2026-02-06', working_days: 13, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 5, project_id: 1, phase_id: 2, phase_type: 'planning_design', name: 'Solution design', owner: 'Vishal', start_date: '2026-02-09', end_date: '2026-02-20', working_days: 10, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 6, project_id: 1, phase_id: 2, phase_type: 'planning_design', name: 'Design Sign-off', owner: null, start_date: '2026-02-27', end_date: '2026-02-27', working_days: 1, is_milestone: true, actual_date: '2026-03-01', status: 'completed' },
      ],
    },
    {
      phase_id: 3, phase_type: 'build', display_name: 'Build',
      planned_start: '2026-03-02', planned_end: '2026-06-19', status: 'in_progress',
      tasks: [
        { id: 7,  project_id: 1, phase_id: 3, phase_type: 'build', name: 'Sprint 1 — Core API',       owner: 'Vishal',    start_date: '2026-03-02', end_date: '2026-03-27', working_days: 20, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 8,  project_id: 1, phase_id: 3, phase_type: 'build', name: 'Sprint 2 — Frontend',       owner: 'Vishal',    start_date: '2026-03-30', end_date: '2026-04-24', working_days: 20, is_milestone: false, actual_date: null, status: 'completed' },
        { id: 9,  project_id: 1, phase_id: 3, phase_type: 'build', name: 'Alpha Build Ready',         owner: null,        start_date: '2026-04-30', end_date: '2026-04-30', working_days: 1,  is_milestone: true,  actual_date: null, status: 'completed' },
        { id: 10, project_id: 1, phase_id: 3, phase_type: 'build', name: 'Sprint 3 — Integration',    owner: 'Vishal',    start_date: '2026-04-27', end_date: '2026-05-22', working_days: 20, is_milestone: false, actual_date: null, status: 'in_progress' },
        { id: 11, project_id: 1, phase_id: 3, phase_type: 'build', name: 'Sprint 4 — UAT prep',       owner: 'Vishal',    start_date: '2026-05-25', end_date: '2026-06-12', working_days: 15, is_milestone: false, actual_date: null, status: 'not_started' },
        { id: 12, project_id: 1, phase_id: 3, phase_type: 'build', name: 'UAT Complete',              owner: null,        start_date: '2026-06-12', end_date: '2026-06-12', working_days: 1,  is_milestone: true,  actual_date: null, status: 'not_started' },
      ],
    },
    {
      phase_id: 4, phase_type: 'deployment', display_name: 'Deployment',
      planned_start: '2026-06-22', planned_end: '2026-07-10', status: 'not_started',
      tasks: [
        { id: 13, project_id: 1, phase_id: 4, phase_type: 'deployment', name: 'Production deploy', owner: 'Vishal',   start_date: '2026-06-22', end_date: '2026-07-03', working_days: 10, is_milestone: false, actual_date: null, status: 'not_started' },
        { id: 14, project_id: 1, phase_id: 4, phase_type: 'deployment', name: 'Go Live',           owner: null,       start_date: '2026-07-10', end_date: '2026-07-10', working_days: 1,  is_milestone: true,  actual_date: null, status: 'not_started' },
      ],
    },
    {
      phase_id: 5, phase_type: 'closure', display_name: 'Closure',
      planned_start: '2026-07-13', planned_end: '2026-07-22', status: 'not_started',
      tasks: [
        { id: 15, project_id: 1, phase_id: 5, phase_type: 'closure', name: 'Lessons learned', owner: 'Giuseppe', start_date: '2026-07-13', end_date: '2026-07-18', working_days: 4, is_milestone: false, actual_date: null, status: 'not_started' },
        { id: 16, project_id: 1, phase_id: 5, phase_type: 'closure', name: 'Project Closed',   owner: null,      start_date: '2026-07-22', end_date: '2026-07-22', working_days: 1, is_milestone: true,  actual_date: null, status: 'not_started' },
      ],
    },
  ],
};

// ─── Ongoing ──────────────────────────────────

export const MOCK_ONGOING_SNAPSHOT: OngoingSnapshot = {
  id: 1,
  project_id: 1,
  phase_id: null,
  reporting_date: '2026-04-30',
  hours_spent_to_date: 320,
  cost_spent_to_date: 36200,
  working_days_used: 58,
  working_days_remaining: 83,
  source: 'manual',
  created_at: '2026-04-30T10:00:00Z',
};

export const MOCK_ONGOING_HISTORY: OngoingSnapshot[] = [
  MOCK_ONGOING_SNAPSHOT,
  {
    id: 2, project_id: 1, phase_id: null, reporting_date: '2026-03-31',
    hours_spent_to_date: 192, cost_spent_to_date: 21800,
    working_days_used: 35, working_days_remaining: 106,
    source: 'manual', created_at: '2026-03-31T09:00:00Z',
  },
  {
    id: 3, project_id: 1, phase_id: null, reporting_date: '2026-02-28',
    hours_spent_to_date: 80, cost_spent_to_date: 9400,
    working_days_used: 16, working_days_remaining: 125,
    source: 'manual', created_at: '2026-02-28T09:00:00Z',
  },
];

export const MOCK_ONGOING: OngoingData = {
  project_name: 'RXI Platform',
  budget_total: 64600,
  total_working_days: 141,
  snapshot: MOCK_ONGOING_SNAPSHOT,
  phases: [
    { id: 1, display_name: 'Feasibility',       phase_type: 'feasibility',     order: 1 },
    { id: 2, display_name: 'Planning & Design', phase_type: 'planning_design', order: 2 },
    { id: 3, display_name: 'Build',             phase_type: 'build',           order: 3 },
    { id: 4, display_name: 'Deployment',        phase_type: 'deployment',      order: 4 },
    { id: 5, display_name: 'Closure',           phase_type: 'closure',         order: 5 },
  ],
};

