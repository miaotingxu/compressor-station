import dayjs from 'dayjs'
import type {
  Alert, AuditLog, DataQualityIssue, DataSource, Device, Diagnosis, Member, RoleDef,
  SchedulePlan, StrategyVersion, TodoItem, WorkOrder, MonthlyReport,
} from '../types'
import { REAL } from './realDataset'
import { STATION } from './stationConfig'
import { assessHealth } from '../utils/health'

/**
 * 真实站点数据基准日：数据包时间范围的末尾。
 * 原演示程序以「应用加载时刻」为基准，真实数据为 2026-03-12 ~ 2026-09-12 的历史归档，
 * 因此这里统一以数据末尾作为站点状态的基准时刻。
 */
export const DEMO_NOW = dayjs(REAL.meta.rangeEnd)
export const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss')
export const fmtShort = (d: dayjs.Dayjs) => d.format('MM-DD HH:mm')
const ago = (h: number) => fmt(DEMO_NOW.subtract(h, 'hour'))
const agoD = (d: number) => DEMO_NOW.subtract(d, 'day').format('YYYY-MM-DD')

export const SITE = {
  factory: STATION.factory,
  name: STATION.name,
  id: STATION.id,
  region: `真实数据集（${STATION.rangeStart.slice(0, 10)} ~ ${STATION.rangeEnd.slice(0, 10)}）`,
}

// ================= 设备档案（2 台真实机组） =================
/** 离心机性能曲线：比功率 kW/(m³/min)，输入为额定比功率 */
const centrifugalCurve = (base: number) => [
  { loadRate: 25, specificPower: +(base * 1.72).toFixed(2) },
  { loadRate: 35, specificPower: +(base * 1.45).toFixed(2) },
  { loadRate: 45, specificPower: +(base * 1.24).toFixed(2) },
  { loadRate: 55, specificPower: +(base * 1.10).toFixed(2) },
  { loadRate: 65, specificPower: +(base * 1.02).toFixed(2) },
  { loadRate: 75, specificPower: +(base * 0.985).toFixed(2) },
  { loadRate: 85, specificPower: +(base * 1.0).toFixed(2) },
  { loadRate: 95, specificPower: +(base * 1.06).toFixed(2) },
]

const deviceNote = (id: string, seed: typeof REAL.devices[number]): string => {
  const run = seed.runningHours == null ? '累计运行时间字段溢出不可用' : `累计运行 ${seed.runningHours} h`
  const maint = seed.nextMaintenanceDueHours == null
    ? '下次保养剩余时间字段异常'
    : `距下次保养 ${seed.nextMaintenanceDueHours} h`
  const extra = id === 'AC-04'
    ? '空气过滤器压降过半为负值，量程存疑；本机停机时长占比约 17.6%。'
    : '二级振动均值约 9.1 mm/s，高于 ISO 10816 C 区下限。'
  return `阿特拉斯 ${seed.model}（${seed.code}），额定 ${seed.ratedPowerKw} kW / ${seed.ratedFlowM3Min} m³/min。${run}，${maint}。${extra}`
}

export const DEVICES: Device[] = REAL.devices.map(seed => {
  // 健康分与喘振风险由真实测点经算法计算，不再使用写死常量
  const health = assessHealth({
    vibration: seed.vibration,
    windingTempC: seed.windingTempC,
    bearingTempC: seed.bearingTempC,
    exhaustTempC: seed.exhaustTempC,
    oilPressureBar: seed.oilPressureBar,
    bovPct: seed.bovPct,
    igvPct: seed.igvPct,
  })
  return {
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    brand: seed.brand,
    model: seed.model,
    ratedPowerKw: seed.ratedPowerKw,
    ratedFlowM3Min: seed.ratedFlowM3Min,
    status: seed.status,
    loadRate: seed.loadRate,
    pressureBar: seed.pressureBar,
    flowM3Min: seed.flowM3Min,
    powerKw: seed.powerKw,
    healthScore: health.score,
    surgeRisk: health.surgeRisk,
    runningHours: seed.runningHours ?? 0,
    installedAt: seed.installedAt,
    lastMaintenanceAt: agoD(30),
    nextMaintenanceDueHours: seed.nextMaintenanceDueHours ?? 0,
    curve: centrifugalCurve(seed.ratedSpecificPower),
    vibration: seed.vibration,
    bearingTempC: seed.bearingTempC,
    windingTempC: seed.windingTempC,
    currentA: seed.currentA,
    oilPressureBar: seed.oilPressureBar,
    exhaustTempC: seed.exhaustTempC,
    igvPct: seed.igvPct,
    bovPct: seed.bovPct,
    healthFindings: health.findings,
    gatewayReliable: seed.gatewayReliable,
    note: deviceNote(seed.id, seed),
  }
})

export const DEVICE_MAP: Record<string, Device> = Object.fromEntries(DEVICES.map(d => [d.id, d]))
export const COMPRESSORS = DEVICES.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')

// ================= 告警（基于真实数据统计） =================
export const ALERTS: Alert[] = [
  {
    id: 'AL-20260912-001', deviceId: 'AC-05', level: 'warning', type: 'vibration',
    title: '5# 二级振动偏高（均值约 9.1 mm/s）',
    description: '5# 机组二级转子振动全周期均值约 9.1 mm/s，高于 ISO 10816 C 区下限 7.1 mm/s；峰值 25.2 mm/s。建议核查轴承状态与对中。',
    raisedAt: ago(4), status: 'unconfirmed', relatedDiagnosisId: 'DG-20260912-001',
  },
  {
    id: 'AL-20260912-002', deviceId: 'AC-04', level: 'critical', type: 'bearing',
    title: '4# 排气/绕组温度接近报警',
    description: '4# 排气温度峰值 115℃、电机绕组温度峰值 90℃、油箱油温均值约 55℃。冷却水温度均值 30.8℃，需核查中冷/后冷换热效率与冷却水流量。',
    raisedAt: ago(6), status: 'unconfirmed', relatedDiagnosisId: 'DG-20260912-002',
  },
  {
    id: 'AL-20260912-003', deviceId: 'AC-04', level: 'critical', type: 'data_quality',
    title: '4#/5# B 相电流全程恒为 0',
    description: '设备运行参数中 4#、5# B 相电流全程为 0，仅有 A/C 相有效，三相不平衡与过流保护无法核验，属数据质量问题。',
    raisedAt: ago(8), status: 'unconfirmed',
  },
  {
    id: 'AL-20260912-004', deviceId: 'AC-04', level: 'warning', type: 'load_anomaly',
    title: '4# 停机时长占比偏高（约 17.6%）',
    description: '4# 全周期停机约 4.66 万分钟（占比约 17.6%），5# 仅约 3%。两台机组出力分配不均，可优化轮换与负载均衡。',
    raisedAt: ago(10), status: 'unconfirmed',
  },
  {
    id: 'AL-20260912-005', deviceId: 'AC-05', level: 'warning', type: 'data_quality',
    title: '加卸载与预警字段缺失',
    description: '运行事件记录中 4#/5# 加卸载字段全程为空、预警字段全程为 0，无法还原加减载时序与预警记录。',
    raisedAt: ago(12), status: 'confirmed', confirmedBy: '苗先生', confirmedAt: ago(11),
  },
  {
    id: 'AL-20260911-006', deviceId: 'AC-04', level: 'info', type: 'pressure',
    title: '母管压力短时波动',
    description: '全周期母管压力 5%~99% 区间为 5.0~6.4 bar，最低 4.8 bar、最高 7.1 bar，合格带按 5.0~6.4 bar 统计合格率约 94.8%。',
    raisedAt: ago(30), status: 'closed', confirmedBy: '苗先生', confirmedAt: ago(29),
    conclusion: '波动与批次用气及机组轮换相关，属工艺性波动，已纳入压力合格率统计口径。', closedAt: ago(28),
  },
]

// ================= 诊断结论 =================
export const DIAGNOSES = [
  {
    id: 'DG-20260912-001', deviceId: 'AC-05',
    conclusion: '5# 二级转子振动全周期均值约 9.1 mm/s，超出 ISO 10816 C 区下限，存在轴承磨损或转子对中不良风险，建议 72h 内停机核查。',
    evidence: [
      '二级振动均值 9.08 mm/s、峰值 25.15 mm/s（全周期）',
      '一级/三级振动均值分别约 3.5 / 3.9 mm/s，二级显著偏高，指向二级转子',
      '电机轴承 D 端温度均值 41.4℃，尚处正常区间',
      '5# 全周期运行率约 97%，负载时间 4309 h',
    ],
    riskLevel: 'medium', possibleCauses: ['二级转子轴承磨损', '转子动平衡劣化', '联轴器对中偏差'],
    suggestedActions: ['72h 内安排二级转子振动频谱复测', '核查轴承润滑与对中', '复测指标：二级振动 ≤ 7.1 mm/s'],
    diagnosedAt: ago(4), modelVersion: 'diag-vibration-v1.0', advanceNoticeHours: 72,
  },
  {
    id: 'DG-20260912-002', deviceId: 'AC-04',
    conclusion: '4# 排气温度峰值 115℃、绕组峰值 90℃，冷却水均值 30.8℃，判断为中冷/后冷换热效率下降或冷却水流量不足，属可控温升异常。',
    evidence: [
      '排气温度均值 88.0℃、峰值 115℃',
      '电机绕组 1U1 峰值 90℃、均值约 69℃',
      '冷却水温度均值 30.8℃、峰值 45℃',
      '油箱油温均值约 55℃',
    ],
    riskLevel: 'medium', possibleCauses: ['中冷/后冷换热面结垢', '冷却水流量不足', '环境温度偏高（站房峰值 45.9℃）'],
    suggestedActions: ['检查冷却水流量与进出水温差', '清理中冷/后冷换热面', '复测指标：排气温度峰值 ≤ 100℃'],
    diagnosedAt: ago(6), modelVersion: 'diag-thermal-v1.0', advanceNoticeHours: 24,
  },
  {
    id: 'DG-20260912-003', deviceId: 'AC-04',
    conclusion: '4#/5# B 相电流全程为 0，三相电流监测不完整，过流与不平衡保护依据不足，需先修复数据链路再评估设备电气健康。',
    evidence: [
      'B 相电流全周期恒为 0（4#、5# 均是）',
      'A 相电流均值 75.4 A、C 相 67.9 A（4#），三相不平衡无法计算',
      'A 相存在 1944 A 级尖峰，疑为采样异常',
    ],
    riskLevel: 'low', possibleCauses: ['B 相电流互感器/采集通道未接入', '点表字段映射错误'],
    suggestedActions: ['核查 B 相电流采集通道与点表映射', '修复后重新计算三相不平衡度'],
    diagnosedAt: ago(8), modelVersion: 'diag-dataquality-v1.0', advanceNoticeHours: 0,
  },
]
export const DIAGNOSIS_MAP = Object.fromEntries(DIAGNOSES.map(d => [d.id, d]))

// ================= 工单 =================
export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-20260912-001', deviceId: 'AC-05', title: '5# 二级转子振动异常核查',
    description: '二级振动均值 9.1 mm/s 超 C 区下限（DG-20260912-001），安排频谱复测并核查轴承与对中。',
    priority: 'high', status: 'assigned', assignee: '刘强', plannedAt: DEMO_NOW.add(1, 'day').format('YYYY-MM-DD'),
    repairRecord: '', spareParts: [{ name: '振动传感器校验套件', spec: '标准', qty: 1 }], retestMetrics: [],
    acceptance: '', createdAt: ago(4), source: 'diagnosis', relatedDiagnosisId: 'DG-20260912-001',
  },
  {
    id: 'WO-20260911-002', deviceId: 'AC-04', title: '4# 冷却系统换热效率检查',
    description: '排气温度峰值 115℃（DG-20260912-002），检查冷却水流量、清理中冷/后冷换热面并复测排气温度。',
    priority: 'medium', status: 'retest_pending', assignee: '赵勇', plannedAt: agoD(1),
    repairRecord: '已完成冷却水流量测量与换热面冲洗，等待负载复测。',
    spareParts: [{ name: '换热面清洗剂', spec: '标准', qty: 2 }],
    retestMetrics: [
      { name: '排气温度峰值', before: '115℃', after: '99℃', pass: true },
      { name: '冷却水进出温差', before: '14.2℃', after: '9.6℃', pass: true },
    ],
    acceptance: '', createdAt: ago(6), source: 'diagnosis', relatedDiagnosisId: 'DG-20260912-002',
  },
]

// ================= 调度方案（2 机组真实站点） =================
export const PLANS: SchedulePlan[] = [
  {
    id: 'PLAN-20260910-001', name: '09-10 机组负载再平衡', strategy: 'balanced', status: 'reviewed',
    createdAt: ago(54), effectiveFrom: ago(52), durationHours: 8,
    actions: [
      { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 82, reason: '4# 当前加载率约 91%，回调至 82% 进入比功率较优区，降低排气与绕组温度' },
      { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 88, reason: '5# 承接 4# 回调缺口，维持母管压力 5.0~6.4 bar' },
    ],
    expectedEnergyKwh: 17820, baselineEnergyKwh: 18260, expectedSavingsPct: 2.4, expectedPressureQualifyPct: 96.5,
    risks: { surgeRisk: 'none', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: '负载微调，母管压力波动预计 ≤0.05 bar，仍在合格带内' },
    explanation: [
      '两台机组额定参数一致（1250 kW / 268.9 m³/min），均衡分配可降低单机温升与振动',
      '真实数据中 4# 停机占比约 17.6%、5# 仅 3%，出力不均；再平衡可改善设备负荷分布',
      '压力合格带按真实母管压力 5%~99% 分位取 5.0~6.4 bar',
    ],
    evidencePeriod: `${ago(48)} ~ ${ago(0)}（真实历史数据）`, createdBy: 'Agent 调度引擎 v1.0',
    approvedBy: '苗先生', approvedAt: ago(51), batchId: 'B-20260910',
    receipts: [
      { deviceId: 'AC-04', command: '加载率调整至 82%', result: 'success', message: '导叶 IGV 调节完成', latencyMs: 2100, finishedAt: ago(51.8) },
      { deviceId: 'AC-05', command: '加载率调整至 88%', result: 'success', message: '导叶 IGV 调节完成', latencyMs: 1980, finishedAt: ago(51.7) },
    ],
    review: {
      energySavingKwh: 440, energySavingPct: 2.4, pressureQualifyPct: 96.5, loadRateDeviationPct: 6.2,
      baselineEnergyKwh: 18260, actualEnergyKwh: 17820, period: `${ago(52)} ~ ${ago(44)}`,
      savingsAmountYuan: 352, replayOnly: false, credibility: '基于真实运行数据的同工况对比推演，端口数据完整率 96%，可信度：中',
    },
  },
  {
    id: 'PLAN-20260911-002', name: '09-11 夜间负载下探', strategy: 'energy', status: 'unknown',
    createdAt: ago(28), effectiveFrom: ago(27), durationHours: 6,
    actions: [
      { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 60, reason: '夜间负荷下探，4# 降载至 60%' },
      { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 70, reason: '5# 承接主力，维持母管压力' },
    ],
    expectedEnergyKwh: 10560, baselineEnergyKwh: 11080, expectedSavingsPct: 4.7, expectedPressureQualifyPct: 96.0,
    risks: { surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: '夜间负荷波动较大，压力合格率略降' },
    explanation: ['夜间用气负荷下探，通过降载减少无效出力', '依据真实数据末尾一日同时段负荷形态推演'],
    evidencePeriod: `${ago(72)} ~ ${ago(24)}`, createdBy: 'Agent 调度引擎 v1.0',
    approvedBy: '苗先生', approvedAt: ago(27.6), batchId: 'B-20260911',
    receipts: [
      { deviceId: 'AC-05', command: '加载率调整至 70%', result: 'success', message: '调节完成', latencyMs: 1320, finishedAt: ago(27.4) },
      { deviceId: 'AC-04', command: '加载率调整至 60%', result: 'timeout', message: '控制网关未在 10s 内返回回执，执行状态未知', latencyMs: 10000, finishedAt: ago(27.3) },
    ],
  },
  {
    id: 'PLAN-20260912-101', name: '09-12 稳供优先候选方案 A', strategy: 'stability', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 88, reason: '保持高冗余出力，优先保压力合格率' },
      { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 90, reason: '两台高位运行，供气冗余最大' },
    ],
    expectedEnergyKwh: 9860, baselineEnergyKwh: 9720, expectedSavingsPct: -1.4, expectedPressureQualifyPct: 97.2,
    risks: { surgeRisk: 'none', overloadRisk: 'low', healthRisk: 'medium', pressureRiskText: '在线产能最大，压力合格率最高；代价是能耗高于基线' },
    explanation: ['以供气冗余为第一目标，两台机组均高位运行', '代价：同产气口径能耗高于基线约 1.4%', '适用：对外供气风险敏感场景'],
    evidencePeriod: `${ago(24)} ~ ${ago(0)}`, createdBy: 'Agent 调度引擎 v1.0', batchId: 'B-20260912',
  },
  {
    id: 'PLAN-20260912-102', name: '09-12 稳供前提下节能候选方案 B（推荐）', strategy: 'balanced', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 78, reason: '4# 回调至比功率较优区，降低温升' },
      { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 92, reason: '5# 承担主力出力，覆盖负荷' },
    ],
    expectedEnergyKwh: 9520, baselineEnergyKwh: 9720, expectedSavingsPct: 2.1, expectedPressureQualifyPct: 96.4,
    risks: { surgeRisk: 'none', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: '负载再分配，母管压力预计维持 5.0 bar 以上' },
    explanation: [
      '依据真实数据末尾一日负荷形态，未来 4h 峰值需求约 0.5 万 m³/min 级',
      '4# 回调降低排气温度与振动负荷，与 WO-20260911-002 冷却系统检修衔接',
      '同产气口径较基线节能约 2.1%',
    ],
    evidencePeriod: `${ago(24)} ~ ${ago(0)}（真实历史 + 负荷预测）`, createdBy: 'Agent 调度引擎 v1.0', batchId: 'B-20260912',
  },
  {
    id: 'PLAN-20260912-103', name: '09-12 设备保护优先候选方案 C', strategy: 'protection', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 65, reason: '4# 温升偏高，主动降载保护' },
      { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 85, reason: '5# 补足负载，但需关注二级振动' },
    ],
    expectedEnergyKwh: 9680, baselineEnergyKwh: 9720, expectedSavingsPct: 0.4, expectedPressureQualifyPct: 95.6,
    risks: { surgeRisk: 'none', overloadRisk: 'medium', healthRisk: 'low', pressureRiskText: '在线产能下降，压力合格率预期降至 95.6%，需错峰配合' },
    explanation: ['以设备保护为第一目标：4# 温升偏高优先降载', '5# 承担缺口，但二级振动偏高，不宜长期高位', '代价：压力合格率下降'],
    evidencePeriod: `${ago(24)} ~ ${ago(0)} + 诊断 DG-20260912-001/002`, createdBy: 'Agent 调度引擎 v1.0', batchId: 'B-20260912',
  },
]

// ================= 策略版本 =================
export const STRATEGIES: StrategyVersion[] = [
  {
    id: 'STG-V1.0.0', version: 'V1.0.0', name: '基础稳供策略', status: 'archived',
    description: '初始版本：固定压力带 5.0~6.6 bar，按额定功率顺序启停，无健康度约束。',
    params: { minLoadRatePct: 60, maxLoadRatePct: 95, pressureBandBar: [5.0, 6.6], surgeMarginPct: 8, priority: 'stability', autoLearnEnabled: false },
    createdAt: '2026-08-01 10:00:00', createdBy: '苗先生', releasedAt: '2026-08-01 10:30:00', rolledBackAt: '2026-08-20 15:00:00',
  },
  {
    id: 'STG-V1.1.0', version: 'V1.1.0', name: '能效优先 + 健康约束策略', status: 'active',
    description: '当前生效版本：基于真实负荷数据的负载再分配，压力带收窄至 5.0~6.4 bar，叠加设备健康度约束，人工审批后下发。',
    params: { minLoadRatePct: 65, maxLoadRatePct: 92, pressureBandBar: [5.0, 6.4], surgeMarginPct: 10, priority: 'balanced', autoLearnEnabled: true },
    createdAt: '2026-08-20 14:00:00', createdBy: '苗先生', releasedAt: '2026-08-20 15:00:00',
    replay: { period: '2026-08-06 ~ 2026-08-19', energySavingPct: 2.6, pressureQualifyPct: 96.1, loadRateDeviationPct: 8.4, verdict: 'pass', notes: '14 天真实数据回放：同产气口径能耗下降 2.6%，压力合格率 96.1%，通过验证' },
  },
  {
    id: 'STG-V1.2.0-C', version: 'V1.2.0-候选', name: '温升与振动约束增强策略', status: 'replay_passed',
    description: '基于真实诊断（4# 温升、5# 二级振动）的候选版本：新增排气温度/绕组温度与振动约束，健康分 <80 的机组默认降载。已完成 14 天真实数据回放验证，待管理员审批发布。',
    params: { minLoadRatePct: 62, maxLoadRatePct: 88, pressureBandBar: [5.0, 6.4], surgeMarginPct: 10, priority: 'balanced', autoLearnEnabled: true },
    createdAt: ago(20), createdBy: 'Agent 策略学习引擎', baseOnVersion: 'V1.1.0',
    replay: { period: `${ago(14)} ~ ${ago(0)}`, energySavingPct: 3.1, pressureQualifyPct: 96.3, loadRateDeviationPct: 7.2, verdict: 'pass', notes: '回放结果：能耗下降 3.1%（较 V1.1.0 +0.5pp），压力合格率 96.3% 达标' },
  },
]

// ================= 数据源与数据质量 =================
// 数据源清单由真实文件推导：协议=文件类型，点位数=字段数，质量=测点平均覆盖率
export const DATA_SOURCES: DataSource[] = REAL.assets.map((a, i) => {
  const own = REAL.points.filter(p => p.file === a.file)
  const quality = own.length ? +(own.reduce((s, p) => s + p.coveragePct, 0) / own.length).toFixed(1) : 100
  const hasIssue = REAL.quality.some(q => q.source === a.file)
  return {
    id: `DS-${String(i + 1).padStart(2, '0')}`,
    name: a.group,
    protocol: a.kind,
    endpoint: a.file,
    status: hasIssue ? 'degraded' : 'online',
    lastSyncAt: a.rangeEnd,
    pointCount: a.fields,
    qualityPct: quality,
  }
})

const dqType = (t: string): DataQualityIssue['type'] =>
  t === 'no_data' ? 'no_data' : t === 'field_missing' || t === 'field_invalid' ? 'field_missing' : 'outlier'

export const DATA_QUALITY_ISSUES: DataQualityIssue[] = REAL.quality.map((q, i) => ({
  id: `DQ-${String(i + 1).padStart(3, '0')}`,
  source: q.source,
  deviceId: q.metric.startsWith('4#') ? 'AC-04' : q.metric.startsWith('5#') ? 'AC-05' : undefined,
  type: dqType(q.type),
  severity: q.severity,
  detail: q.detail,
  detectedAt: ago(6 - i),
  resolved: false,
  blockPlan: false,
}))

// ================= 成员 / 角色 =================
export const ROLE_DEFS: RoleDef[] = [
  { key: 'operator', name: '值班员', desc: '运行监视、告警处置、方案审批与指令下发（唯一可下发控制指令的业务角色）', permissions: ['view:all', 'alert:handle', 'plan:approve', 'plan:reject', 'plan:dispatch', 'todo:handle'] },
  { key: 'energy_manager', name: '能源/生产负责人', desc: '能效收益、报告与目标达成查看；只读业务，不可下发控制指令', permissions: ['view:all', 'report:export'] },
  { key: 'device_engineer', name: '设备工程师', desc: '设备健康、诊断、喘振风险查看与工单全流程处理', permissions: ['view:all', 'alert:handle', 'workorder:manage', 'workorder:close'] },
  { key: 'admin', name: '系统管理员', desc: '站点与设备档案、阈值、数据源、策略版本、成员与审计管理；不可直接下发控制指令', permissions: ['view:all', 'config:manage', 'strategy:manage', 'member:manage', 'audit:view'] },
]

export const MEMBERS: Member[] = [
  { id: 'M-001', name: '苗先生', role: 'operator', account: 'zhangwei', phone: '138****2168', sites: ['AS-01'], active: true },
  { id: 'M-002', name: '苗先生', role: 'operator', account: 'lijing', phone: '139****5521', sites: ['AS-01'], active: true },
  { id: 'M-003', name: '王芳', role: 'energy_manager', account: 'wangfang', phone: '137****8834', sites: ['AS-01'], active: true },
  { id: 'M-004', name: '刘强', role: 'device_engineer', account: 'liuqiang', phone: '136****9027', sites: ['AS-01'], active: true },
  { id: 'M-005', name: '赵勇', role: 'device_engineer', account: 'zhaoyong', phone: '135****4413', sites: ['AS-01'], active: true },
  { id: 'M-006', name: '苗先生', role: 'admin', account: 'chenming', phone: '138****7745', sites: ['AS-01'], active: true },
]

// ================= 审计日志（预置） =================
export const AUDIT_LOGS: AuditLog[] = [
  { id: 'LOG-9001', time: ago(54), actor: '系统', role: 'admin', action: '策略发布', target: 'V1.1.0', detail: 'V1.1.0 策略回放验证通过后发布生效', result: 'success' },
  { id: 'LOG-9002', time: ago(51.9), actor: '苗先生', role: 'operator', action: '调度下发', target: 'PLAN-20260910-001', detail: '2 台设备指令全部成功下发，逐台回执确认', result: 'success' },
  { id: 'LOG-9003', time: ago(28), actor: '苗先生', role: 'operator', action: '方案审批', target: 'PLAN-20260911-002', detail: '批准 09-11 夜间负载下探方案', result: 'success' },
  { id: 'LOG-9004', time: ago(27.3), actor: '系统', role: 'admin', action: '执行回执超时', target: 'AC-04', detail: '4# 控制网关 10s 未回执，方案标记为"状态未知"，已创建异常待办', result: 'success' },
  { id: 'LOG-9005', time: ago(10), actor: '王芳', role: 'energy_manager', action: '调度下发（越权尝试）', target: 'PLAN-20260911-002', detail: '能源负责人无控制下发权限，系统拒绝并生成审计记录', result: 'denied' },
  { id: 'LOG-9006', time: ago(6), actor: '赵勇', role: 'device_engineer', action: '工单复测提交', target: 'WO-20260911-002', detail: '提交 4# 冷却系统复测数据：排气温度峰值 99℃，合格', result: 'success' },
]

// ================= 待办（预置） =================
export const TODOS: TodoItem[] = [
  { id: 'TD-001', kind: 'plan_approval', title: '3 套调度方案待审批', detail: '批次 B-20260912：稳供优先 / 稳供前提下节能（推荐）/ 设备保护优先，请比较后审批或驳回', createdAt: ago(1), link: '/scheduling', done: false, severity: 'high', refId: 'B-20260912' },
  { id: 'TD-002', kind: 'alert_confirm', title: '5# 二级振动偏高告警未确认', detail: '均值约 9.1 mm/s，关联诊断 DG-20260912-001', createdAt: ago(4), link: '/operation', done: false, severity: 'high', refId: 'AL-20260912-001' },
  { id: 'TD-003', kind: 'alert_confirm', title: '4# 排气/绕组温度接近报警未确认', detail: '排气峰值 115℃、绕组峰值 90%，关联诊断 DG-20260912-002', createdAt: ago(6), link: '/operation', done: false, severity: 'high', refId: 'AL-20260912-002' },
  { id: 'TD-004', kind: 'data_quality', title: '4#/5# B 相电流全程为 0', detail: '三相电流监测不完整，过流与不平衡保护依据不足', createdAt: ago(8), link: '/data-strategy', done: false, severity: 'high', refId: 'DQ-001' },
  { id: 'TD-005', kind: 'workorder', title: '工单 WO-20260912-001 处理中', detail: '5# 二级转子振动异常核查，已指派刘强', createdAt: ago(4), link: '/health', done: false, severity: 'medium', refId: 'WO-20260912-001' },
  { id: 'TD-006', kind: 'workorder', title: '工单 WO-20260911-002 待复测验收', detail: '4# 冷却系统复测数据合格，待设备工程师验收关闭', createdAt: ago(6), link: '/health', done: false, severity: 'medium', refId: 'WO-20260911-002' },
  { id: 'TD-007', kind: 'execution_abnormal', title: '方案 PLAN-20260911-002 执行状态未知', detail: '4# 回执超时，需人工现场核实后选择"重新下发"或"人工处置"关闭', createdAt: ago(27.3), link: '/execution', done: false, severity: 'high', refId: 'PLAN-20260911-002' },
  { id: 'TD-008', kind: 'strategy_release', title: '策略候选版本 V1.2.0 待发布审批', detail: '真实数据回放验证通过（能耗下降 3.1%），请审批发布或驳回', createdAt: ago(20), link: '/data-strategy', done: false, severity: 'medium', refId: 'STG-V1.2.0-C' },
  { id: 'TD-009', kind: 'data_quality', title: '加卸载/预警字段缺失', detail: '运行事件记录中加卸载字段全空、预警字段全为 0', createdAt: ago(12), link: '/data-strategy', done: false, severity: 'low', refId: 'DQ-002' },
  { id: 'TD-010', kind: 'energy_deviation', title: '近期能耗高于基线', detail: '近期期系统比功率高于基线期，受季节与温升影响，请查看收益明细', createdAt: ago(12), link: '/energy', done: false, severity: 'low', refId: 'TD-010' },
]

// ================= 月度报告（基于真实数据） =================
const mBase = REAL.metrics.baseline
const mCur = REAL.metrics.current
export const MONTHLY_REPORT: MonthlyReport = {
  id: 'RPT-202609', title: '2026-09 空压站能效报告（真实数据）', month: '2026-09', generatedAt: ago(3),
  dataRange: `2026-03-12 ~ 2026-09-12（真实运行数据，分界 ${REAL.meta.midpoint.slice(0, 10)}）`,
  replayOnly: false,
  metrics: [
    { name: '系统比功率对比', value: `${mCur.specificEnergy} kWh/m³（近期）`, baseline: `基线期 ${mBase.specificEnergy} kWh/m³`, note: `真实数据两期对比，变化 ${(((mCur.specificEnergy - mBase.specificEnergy) / mBase.specificEnergy) * 100).toFixed(1)}%（正值表示近期能耗更高，受季节温升影响）` },
    { name: '供气压力合格率', value: `${mCur.pressureQualifyPct}%`, baseline: '合格带 5.0~6.4 bar（真实母管压力分位）', note: '统计自真实母管压力分钟数据' },
    { name: '加载率偏离度', value: `±${mCur.loadDeviationPct}%`, baseline: `基线期 ±${mBase.loadDeviationPct}%`, note: '实际负荷率相对 80% 目标带的平均绝对偏差（真实数据计算）' },
    { name: '日均低载时长（负荷率<50%）', value: `${mCur.lowLoadHours} h`, baseline: `基线期 ${mBase.lowLoadHours} h`, note: '真实数据统计，近期期低载时长显著下降' },
    { name: '机组运行率', value: `${mCur.runRatePct}%`, baseline: `基线期 ${mBase.runRatePct}%`, note: '至少一台机组运行的时间占比（真实数据统计）' },
    { name: '数据质量告警', value: `${REAL.quality.length} 项`, baseline: '其中 critical 2 项', note: 'B 相电流缺失、4# 保养剩余时间溢出等，详见数据与策略页' },
  ],
}
