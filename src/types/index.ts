// ===== 空压站智能调度 Agent 类型定义 =====

export type DeviceKind = 'centrifugal' | 'screw' | 'dryer' | 'tank' | 'sensor'
export type DeviceStatus = 'running' | 'standby' | 'maintenance' | 'fault'
export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

/** 性能曲线点：加载率 -> 比功率 kW/(m³/min) */
export interface CurvePoint {
  loadRate: number
  specificPower: number
}

export interface Device {
  id: string
  name: string
  kind: DeviceKind
  brand: string
  model: string
  ratedPowerKw: number
  ratedFlowM3Min: number
  status: DeviceStatus
  loadRate: number
  pressureBar: number
  flowM3Min: number
  powerKw: number
  healthScore: number
  surgeRisk: RiskLevel
  runningHours: number
  installedAt: string
  lastMaintenanceAt: string
  nextMaintenanceDueHours: number
  curve: CurvePoint[]
  /** 振动 mm/s、轴承温度 ℃、绕组温度 ℃、电流 A —— 健康监测量 */
  vibration: number
  bearingTempC: number
  windingTempC: number
  currentA: number
  oilPressureBar: number
  note?: string
}

export type AlertLevel = 'info' | 'warning' | 'critical'
export type AlertStatus = 'unconfirmed' | 'confirmed' | 'dispatched_scheduling' | 'to_workorder' | 'closed'

export interface Alert {
  id: string
  deviceId: string
  level: AlertLevel
  type: 'load_anomaly' | 'bearing' | 'surge' | 'pressure' | 'data_quality' | 'energy' | 'vibration'
  title: string
  description: string
  raisedAt: string
  status: AlertStatus
  confirmedBy?: string
  confirmedAt?: string
  conclusion?: string
  closedAt?: string
  relatedPlanId?: string
  relatedWorkOrderId?: string
  relatedDiagnosisId?: string
}

export type PlanStrategy = 'stability' | 'balanced' | 'energy' | 'protection'
export type PlanStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'dispatching'
  | 'executed'
  | 'execute_failed'
  | 'unknown'
  | 'reviewed'

export type PlanActionType = 'start' | 'stop' | 'adjust_load' | 'set_pressure'

export interface PlanAction {
  deviceId: string
  action: PlanActionType
  targetLoadRate?: number
  targetPressureBar?: number
  reason: string
}

export interface PlanRisk {
  surgeRisk: RiskLevel
  overloadRisk: RiskLevel
  healthRisk: RiskLevel
  pressureRiskText: string
}

export interface ExecutionReceipt {
  deviceId: string
  command: string
  result: 'success' | 'failed' | 'timeout'
  message: string
  latencyMs: number
  finishedAt: string
}

export interface PlanReviewResult {
  energySavingKwh: number
  energySavingPct: number
  pressureQualifyPct: number
  loadRateDeviationPct: number
  baselineEnergyKwh: number
  actualEnergyKwh: number
  period: string
  savingsAmountYuan: number
  replayOnly: boolean
  credibility: string
}

export interface SchedulePlan {
  id: string
  name: string
  strategy: PlanStrategy
  status: PlanStatus
  createdAt: string
  effectiveFrom: string
  durationHours: number
  actions: PlanAction[]
  expectedEnergyKwh: number
  baselineEnergyKwh: number
  expectedSavingsPct: number
  expectedPressureQualifyPct: number
  risks: PlanRisk
  explanation: string[]
  evidencePeriod: string
  createdBy: string
  approvedBy?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectReason?: string
  batchId?: string
  receipts?: ExecutionReceipt[]
  review?: PlanReviewResult
  surgeBlocked?: boolean
}

export type WorkOrderStatus = 'created' | 'assigned' | 'processing' | 'retest_pending' | 'closed'

export interface SparePart {
  name: string
  spec: string
  qty: number
}

export interface RetestMetric {
  name: string
  before: string
  after: string
  pass: boolean
}

export interface WorkOrder {
  id: string
  deviceId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: WorkOrderStatus
  assignee?: string
  plannedAt?: string
  repairRecord?: string
  spareParts: SparePart[]
  retestMetrics: RetestMetric[]
  acceptance?: string
  createdAt: string
  closedAt?: string
  source: 'diagnosis' | 'alert' | 'manual'
  relatedDiagnosisId?: string
  relatedAlertId?: string
}

export interface Diagnosis {
  id: string
  deviceId: string
  conclusion: string
  evidence: string[]
  riskLevel: RiskLevel
  possibleCauses: string[]
  suggestedActions: string[]
  diagnosedAt: string
  modelVersion: string
  advanceNoticeHours?: number
}

export type StrategyStatus = 'draft' | 'replay_passed' | 'pending_release' | 'active' | 'rolled_back' | 'archived'

export interface ReplayResult {
  period: string
  energySavingPct: number
  pressureQualifyPct: number
  loadRateDeviationPct: number
  verdict: 'pass' | 'fail'
  notes: string
}

export interface StrategyVersion {
  id: string
  version: string
  name: string
  status: StrategyStatus
  description: string
  params: {
    minLoadRatePct: number
    maxLoadRatePct: number
    pressureBandBar: [number, number]
    surgeMarginPct: number
    priority: PlanStrategy
    autoLearnEnabled: boolean
  }
  replay?: ReplayResult
  createdAt: string
  createdBy: string
  releasedAt?: string
  rolledBackAt?: string
  baseOnVersion?: string
}

export interface DataQualityIssue {
  id: string
  source: string
  deviceId?: string
  type: 'field_missing' | 'stale_data' | 'outlier' | 'no_data'
  severity: 'warning' | 'critical'
  detail: string
  detectedAt: string
  resolved: boolean
  blockPlan: boolean
}

export interface DataSource {
  id: string
  name: string
  protocol: string
  endpoint: string
  status: 'online' | 'degraded' | 'offline'
  lastSyncAt: string
  pointCount: number
  qualityPct: number
}

export interface Member {
  id: string
  name: string
  role: RoleKey
  account: string
  phone: string
  sites: string[]
  active: boolean
}

export type RoleKey = 'operator' | 'energy_manager' | 'device_engineer' | 'admin'

export interface RoleDef {
  key: RoleKey
  name: string
  desc: string
  permissions: string[]
}

export type AuditResult = 'success' | 'denied'

export interface AuditLog {
  id: string
  time: string
  actor: string
  role: RoleKey
  action: string
  target: string
  detail: string
  result: AuditResult
}

export interface TodoItem {
  id: string
  /** 关联实体 ID：告警/方案/工单/策略/数据质量问题等，用于业务动作后自动核销 */
  refId?: string
  kind: 'plan_approval' | 'alert_confirm' | 'workorder' | 'data_quality' | 'energy_deviation' | 'strategy_release' | 'execution_abnormal'
  title: string
  detail: string
  createdAt: string
  link: string
  done: boolean
  resolvedAt?: string
  resolvedBy?: string
  resolveNote?: string
  severity: 'high' | 'medium' | 'low'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  time: string
  structured?: AgentStructuredAnswer
  suggested?: string[]
}

export interface AgentStructuredAnswer {
  conclusion: string
  evidence: string[]
  dataPeriod: string
  devices: string[]
  risks: string[]
  nextActions: string[]
  createPlan?: {
    strategy: PlanStrategy
    actions: PlanAction[]
    effectiveFrom: string
  }
}

export interface EnergyRecord {
  date: string
  /** 系统比功率 kWh/(m³·bar) 越低越好 */
  specificEnergy: number
  powerKwh: number
  airflowKm3: number
  pressureQualifyPct: number
  avgLoadDeviationPct: number
  lowLoadHours: number
  mode: 'baseline' | 'ai'
}

export interface MonthlyReport {
  id: string
  title: string
  month: string
  generatedAt: string
  metrics: { name: string; value: string; baseline: string; note: string }[]
  dataRange: string
  replayOnly: boolean
}
