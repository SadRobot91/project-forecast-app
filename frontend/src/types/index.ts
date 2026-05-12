// ─────────────────────────────────────────────
// Domain Types — shared across the entire app
// ─────────────────────────────────────────────

export type UserRole = 'pm' | 'dm';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export type RAGStatus = 'IN_LINEA' | 'A_RISCHIO' | 'FUORI_BUDGET';

export type PhaseType = 'feasibility' | 'planning_design' | 'build' | 'deployment' | 'closure';
export type ProjectStatus = 'active' | 'on_hold' | 'closed' | 'archived';
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProjectSummary {
  id: number;
  name: string;
  status: ProjectStatus;
  rag_status: RAGStatus;
  current_phase: PhaseType | null;
  budget_total: number;
  budget_spent: number;
  budget_pct: number;
  days_remaining: number;
  currency: string;
}

// ─── Dashboard ───────────────────────────────

export interface DashboardKPIs {
  cost_spent: number;
  budget_total: number;
  revised_forecast: number;
  daily_burn_rate: number;
  variance: number;
  days_remaining: number;
  budget_pct: number;
  rag_status: RAGStatus;
  last_sync_at: string | null;
  last_sync_source: 'manual' | 'keyedin_api' | null;
}

export interface PhaseBudgetRow {
  phase_id: number;
  phase_type: PhaseType;
  planned_start: string;
  planned_end: string;
  working_days: number;
  planned_hours: number;
  burn_rate_per_day: number;
  budget: number;
  budget_pct_of_total: number;
}

export interface MilestoneItem {
  id: number;
  name: string;
  planned_date: string;
  actual_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  is_milestone: boolean;
}

export interface DashboardData {
  project_id: number;
  project_name: string;
  kpis: DashboardKPIs;
  phase_budgets: PhaseBudgetRow[];
  milestones: MilestoneItem[];
}

// ─── Baseline ────────────────────────────────

export interface BaselinePhase {
  phase_id: number;
  phase_type: PhaseType;
  order: number;
  planned_start: string;
  planned_end: string;
  working_days: number;
  planned_hours: number;
  budget: number;
  contingency_pct: number;
  status: PhaseStatus;
  is_locked: boolean;
}

export interface BaselineData {
  project_id: number;
  project_name: string;
  phases: BaselinePhase[];
  is_locked: boolean;
  locked_at: string | null;
  contingency_pct: number;
  total_budget: number;
  total_forecast: number;
}

// ─── Allocation ───────────────────────────────

export interface Resource {
  id: number;
  name: string;
  role: string;
  day_rate: number;
}

export interface AllocationCell {
  resource_id: number;
  phase_id: number;
  week_start: string; // Monday of the week — YYYY-MM-DD
  fte: number;
  working_days: number;
  weekly_cost: number;
}

export interface AllocationPhaseMatrix {
  phase_id: number;
  phase_type: PhaseType;
  planned_start: string;
  planned_end: string;
  resources: Resource[];
  cells: AllocationCell[];
  phase_budget: number;
  avg_fte: number;
  burn_rate_per_day: number;
}

export interface AllocationData {
  project_id: number;
  project_name: string;
  phases: AllocationPhaseMatrix[];
  all_resources: Resource[];
}

// ─── Resource Registry ────────────────────────

export interface ResourceProjectFTE {
  project_id: number;
  project_name: string;
  project_status: ProjectStatus;
  week_start: string;
  fte: number;
}

export interface ResourceRegistryRow {
  resource: Resource;
  allocations: ResourceProjectFTE[];
  totals: Record<string, number>;
}

export interface ResourceRegistryData {
  weeks: string[];
  rows: ResourceRegistryRow[];
  has_overallocation: boolean;
}

export interface ResourceRegistryFilters {
  resource_id?: number;
  project_id?: number;
  date_from?: string;
  date_to?: string;
}

// ─── Ongoing ─────────────────────────────────

export interface OngoingSnapshot {
  id: number;
  project_id: number;
  reporting_date: string;
  hours_spent_to_date: number;
  cost_spent_to_date: number;
  working_days_used: number;
  working_days_remaining: number;
  source: 'manual' | 'keyedin_api';
  created_at: string;
}

export interface OngoingData {
  project_name: string;
  budget_total: number;
  total_working_days: number;
  snapshot: OngoingSnapshot | null;
}

export interface OngoingPayload {
  reporting_date: string;
  cost_spent_to_date: number;
  hours_spent_to_date: number;
  working_days_used: number;
  working_days_remaining: number;
}

// ─── Gantt ────────────────────────────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export interface GanttTask {
  id: number;
  project_id: number;
  phase_id: number;
  phase_type: PhaseType;
  name: string;
  owner: string | null;
  start_date: string;
  end_date: string;
  working_days: number;
  is_milestone: boolean;
  actual_date: string | null;
  status: TaskStatus;
}

export interface GanttPhaseData {
  phase_id: number;
  phase_type: PhaseType;
  planned_start: string;
  planned_end: string;
  status: PhaseStatus;
  tasks: GanttTask[];
}

export interface GanttData {
  project_id: number;
  project_name: string;
  project_start: string;
  project_end: string;
  phases: GanttPhaseData[];
}
