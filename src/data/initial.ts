import dayjs from 'dayjs'
import type {
  Alert, AuditLog, DataQualityIssue, DataSource, Device, Diagnosis, Member, RoleDef,
  SchedulePlan, StrategyVersion, TodoItem, WorkOrder, MonthlyReport,
} from '../types'

/** 演示环境时间基准：应用加载时刻 */
export const DEMO_NOW = dayjs()
export const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss')
export const fmtShort = (d: dayjs.Dayjs) => d.format('MM-DD HH:mm')
const ago = (h: number) => fmt(DEMO_NOW.subtract(h, 'hour'))
const agoD = (d: number) => DEMO_NOW.subtract(d, 'day').format('YYYY-MM-DD')

export const SITE = { factory: '海川精工', name: '1 号空压站', id: 'AS-01', region: '华东制造基地' }

// ================= 设备档案 =================
/** 性能曲线：比功率 kW/(m³/min)，越低越好。离心机 70-85% 加载率最优，低载时急剧恶化并逼近喘振区 */
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
/** 螺杆机曲线：55-75% 较优 */
const screwCurve = (base: number) => [
  { loadRate: 20, specificPower: +(base * 1.38).toFixed(2) },
  { loadRate: 30, specificPower: +(base * 1.22).toFixed(2) },
  { loadRate: 40, specificPower: +(base * 1.12).toFixed(2) },
  { loadRate: 50, specificPower: +(base * 1.05).toFixed(2) },
  { loadRate: 60, specificPower: +(base * 1.0).toFixed(2) },
  { loadRate: 70, specificPower: +(base * 0.99).toFixed(2) },
  { loadRate: 80, specificPower: +(base * 1.02).toFixed(2) },
  { loadRate: 90, specificPower: +(base * 1.09).toFixed(2) },
]

export const DEVICES: Device[] = [
  {
    id: 'AC-01', name: '1# 离心式空压机', kind: 'centrifugal', brand: '海川动力', model: 'HC-C1600',
    ratedPowerKw: 1600, ratedFlowM3Min: 240, status: 'running',
    loadRate: 78, pressureBar: 0.82, flowM3Min: 187, powerKw: 1216,
    healthScore: 86, surgeRisk: 'medium', runningHours: 28650, installedAt: '2019-06-12', lastMaintenanceAt: agoD(75),
    nextMaintenanceDueHours: 1350, curve: centrifugalCurve(6.67),
    vibration: 3.1, bearingTempC: 71, windingTempC: 68, currentA: 218, oilPressureBar: 0.31,
    note: '一级叶轮振动有上升趋势，进口滤网压差 4.2 kPa 偏高导致吸入流量下降，喘振裕度收窄，已列入重点观察。',
  },
  {
    id: 'AC-02', name: '2# 离心式空压机', kind: 'centrifugal', brand: '海川动力', model: 'HC-C1320',
    ratedPowerKw: 1320, ratedFlowM3Min: 200, status: 'running',
    loadRate: 65, pressureBar: 0.81, flowM3Min: 130, powerKw: 832,
    healthScore: 71, surgeRisk: 'low', runningHours: 24310, installedAt: '2020-03-18', lastMaintenanceAt: agoD(210),
    nextMaintenanceDueHours: 90, curve: centrifugalCurve(6.6),
    vibration: 6.8, bearingTempC: 88, windingTempC: 74, currentA: 142, oilPressureBar: 0.29,
    note: '驱动端轴承温度与振动持续偏高，诊断为轴承磨损早期，建议 72h 内安排检修，检修前建议降载运行。',
  },
  {
    id: 'AC-03', name: '3# 螺杆式空压机', kind: 'screw', brand: '霍尼康', model: 'HK-S250',
    ratedPowerKw: 250, ratedFlowM3Min: 40, status: 'running',
    loadRate: 32, pressureBar: 0.80, flowM3Min: 12.8, powerKw: 101,
    healthScore: 90, surgeRisk: 'none', runningHours: 15820, installedAt: '2021-09-02', lastMaintenanceAt: agoD(120),
    nextMaintenanceDueHours: 1800, curve: screwCurve(6.25),
    vibration: 1.9, bearingTempC: 62, windingTempC: 59, currentA: 42, oilPressureBar: 0.35,
    note: '长期低加载率运行（约 32%），处于"大马拉小车"工况，比功率 7.6 kW/(m³/min)，较本机最优值 6.19 偏高约 23%。',
  },
  {
    id: 'AC-04', name: '4# 螺杆式空压机', kind: 'screw', brand: '霍尼康', model: 'HK-S355',
    ratedPowerKw: 355, ratedFlowM3Min: 60, status: 'standby',
    loadRate: 0, pressureBar: 0, flowM3Min: 0, powerKw: 0,
    healthScore: 93, surgeRisk: 'none', runningHours: 11240, installedAt: '2022-05-20', lastMaintenanceAt: agoD(60),
    nextMaintenanceDueHours: 2400, curve: screwCurve(5.92),
    vibration: 0, bearingTempC: 28, windingTempC: 26, currentA: 0, oilPressureBar: 0,
    note: '热备机组，本站效率最高机组（70% 加载率比功率 5.86）；控制网关固件版本较低，历史下发偶发回执超时。',
  },
  {
    id: 'AC-05', name: '5# 离心式空压机', kind: 'centrifugal', brand: '海川动力', model: 'HC-C1100',
    ratedPowerKw: 1100, ratedFlowM3Min: 160, status: 'maintenance',
    loadRate: 0, pressureBar: 0, flowM3Min: 0, powerKw: 0,
    healthScore: 78, surgeRisk: 'none', runningHours: 20110, installedAt: '2020-11-08', lastMaintenanceAt: ago(26),
    nextMaintenanceDueHours: 720, curve: centrifugalCurve(6.88),
    vibration: 0, bearingTempC: 0, windingTempC: 0, currentA: 0, oilPressureBar: 0,
    note: '计划性大修中（更换三级冷却器芯），预计还需 18 小时恢复，检修期间数据通道暂停。', 
  },
  {
    id: 'DR-01', name: '1# 冷冻式干燥机', kind: 'dryer', brand: '赛尔干燥', model: 'SE-120',
    ratedPowerKw: 12, ratedFlowM3Min: 120, status: 'running',
    loadRate: 74, pressureBar: 0.80, flowM3Min: 89, powerKw: 9.6,
    healthScore: 92, surgeRisk: 'none', runningHours: 22000, installedAt: '2020-03-18', lastMaintenanceAt: agoD(90),
    nextMaintenanceDueHours: 1500, curve: [], vibration: 1.2, bearingTempC: 0, windingTempC: 0, currentA: 18, oilPressureBar: 0,
    note: '露点 -22℃，运行正常。',
  },
  {
    id: 'DR-02', name: '2# 冷冻式干燥机', kind: 'dryer', brand: '赛尔干燥', model: 'SE-120',
    ratedPowerKw: 12, ratedFlowM3Min: 120, status: 'running',
    loadRate: 71, pressureBar: 0.80, flowM3Min: 86, powerKw: 9.3,
    healthScore: 89, surgeRisk: 'none', runningHours: 21400, installedAt: '2020-03-18', lastMaintenanceAt: agoD(90),
    nextMaintenanceDueHours: 1620, curve: [], vibration: 1.3, bearingTempC: 0, windingTempC: 0, currentA: 17.5, oilPressureBar: 0,
    note: '露点 -21℃，运行正常。',
  },
  {
    id: 'AT-01', name: '1# 储气罐', kind: 'tank', brand: '本地制造', model: 'AT-30m³',
    ratedPowerKw: 0, ratedFlowM3Min: 0, status: 'running',
    loadRate: 0, pressureBar: 0.81, flowM3Min: 0, powerKw: 0,
    healthScore: 96, surgeRisk: 'none', runningHours: 44000, installedAt: '2019-06-12', lastMaintenanceAt: agoD(30),
    nextMaintenanceDueHours: 0, curve: [], vibration: 0, bearingTempC: 0, windingTempC: 0, currentA: 0, oilPressureBar: 0,
    note: '容积 30m³，年检有效期至 2027-04。',
  },
  {
    id: 'AT-02', name: '2# 储气罐', kind: 'tank', brand: '本地制造', model: 'AT-20m³',
    ratedPowerKw: 0, ratedFlowM3Min: 0, status: 'running',
    loadRate: 0, pressureBar: 0.80, flowM3Min: 0, powerKw: 0,
    healthScore: 95, surgeRisk: 'none', runningHours: 39800, installedAt: '2020-03-18', lastMaintenanceAt: agoD(30),
    nextMaintenanceDueHours: 0, curve: [], vibration: 0, bearingTempC: 0, windingTempC: 0, currentA: 0, oilPressureBar: 0,
    note: '容积 20m³，年检有效期至 2026-11。',
  },
]

export const DEVICE_MAP: Record<string, Device> = Object.fromEntries(DEVICES.map(d => [d.id, d]))
export const COMPRESSORS = DEVICES.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')

// ================= 告警 =================
export const ALERTS: Alert[] = [
  {
    id: 'AL-20260921-001', deviceId: 'AC-03', level: 'warning', type: 'load_anomaly',
    title: 'AC-03 持续低加载率运行（"大马拉小车"）',
    description: '近 72 小时平均加载率 31.5%，低于经济运行下限 55%，单位产气能耗比最优区间高约 22%。建议纳入本轮调度优化。',
    raisedAt: ago(6), status: 'unconfirmed',
  },
  {
    id: 'AL-20260921-002', deviceId: 'AC-02', level: 'critical', type: 'bearing',
    title: 'AC-02 驱动端轴承温度超阈值（88℃）',
    description: '轴承温度连续 4 小时超过 85℃ 报警阈值，振动速度 6.8 mm/s 接近 ISO 10816 C 区上限。结合频谱特征诊断为轴承磨损早期，预计 36 小时内需检修。',
    raisedAt: ago(4), status: 'unconfirmed', relatedDiagnosisId: 'DG-20260921-002',
  },
  {
    id: 'AL-20260921-003', deviceId: 'AC-01', level: 'critical', type: 'surge',
    title: 'AC-01 喘振裕度收窄，接近喘振边界',
    description: '当前运行点距喘振边界 8.6%（安全裕度阈值 10%），进口导叶开度与管网阻力组合工况不利。若负荷继续上升或母管压力抬升，存在喘振风险，预计提前量 45 秒可触发紧急联锁保护。',
    raisedAt: ago(2), status: 'unconfirmed', relatedDiagnosisId: 'DG-20260921-003',
  },
  {
    id: 'AL-20260920-004', deviceId: 'DR-01', level: 'warning', type: 'data_quality',
    title: 'DR-01 露点数据更新延迟',
    description: '露点变送器数据最后更新时间距当前 2.1 小时，超过 1 小时陈旧阈值，已通知仪表班检查通讯。',
    raisedAt: ago(9), status: 'confirmed', confirmedBy: '张伟', confirmedAt: ago(8),
  },
  {
    id: 'AL-20260919-005', deviceId: 'AC-02', level: 'warning', type: 'vibration',
    title: 'AC-02 振动速度上升趋势',
    description: '驱动端轴承振动 7 日内由 4.2 mm/s 上升至 6.8 mm/s，增幅 62%，建议关注。',
    raisedAt: ago(30), status: 'to_workorder', confirmedBy: '刘强', confirmedAt: ago(28), relatedWorkOrderId: 'WO-20260920-002',
  },
  {
    id: 'AL-20260918-006', deviceId: 'AT-01', level: 'info', type: 'pressure',
    title: '母管压力短时波动',
    description: '09-18 14:20 母管压力短时波动 0.82→0.76→0.81 bar，持续 90 秒，与产线批次用气相关，未低于合格下限。',
    raisedAt: ago(80), status: 'closed', confirmedBy: '张伟', confirmedAt: ago(79),
    conclusion: '确认为三车间批次投料集中用气所致，属正常工况波动，加强排班错峰即可。', closedAt: ago(78),
  },
]

// ================= 诊断结论 =================
export const DIAGNOSES = [
  {
    id: 'DG-20260921-001', deviceId: 'AC-03',
    conclusion: 'AC-03 长期处于低加载率运行（平均 31.5%），偏离经济运行区间，单位产气能耗偏高约 22%，并存在停机周期性启停损耗。',
    evidence: [
      '近 30 天加载率分布：24%~38% 区间占比 81%，仅 4% 时间处于 55% 以上',
      '当前比功率 7.63 kW/(m³/min)，高于该机型最优比功率 6.19 约 23.3%',
      '启停次数：日均 9.2 次，远高于经济运行参考值 ≤2 次/日',
      '电流 42A，约为额定电流的 34%，效率处于低效区',
    ],
    riskLevel: 'medium', possibleCauses: ['选型余量过大（设计选型按远期负荷）', '调度策略未考虑机组容量匹配', '夜间低谷时段仍保持该机组运行'],
    suggestedActions: ['纳入智能调度：夜间与低峰时段停运 AC-03，改由 AC-04 承担', '恢复后保持在 55%~75% 加载率区间运行', '持续跟踪两周并复核收益'],
    diagnosedAt: ago(7), modelVersion: '.diag-bearing-v2.3', advanceNoticeHours: 72,
  },
  {
    id: 'DG-20260921-002', deviceId: 'AC-02',
    conclusion: 'AC-02 驱动端轴承磨损早期，若不处理预计 36 小时内发展为二级报警，7 天内出现非计划停机概率 63%。',
    evidence: [
      '轴承温度 88℃，超报警阈值 85℃，连续 4 小时',
      '振动速度 6.8 mm/s（ISO 10816 由 B 区进入 C 区边缘）',
      '包络谱 2× 轴频与 4× 轴频幅值 30 天内增长 2.4 倍，符合滚动体剥落早期特征',
      '该轴承上次更换距今 210 天，处于寿命中后段',
    ],
    riskLevel: 'high', possibleCauses: ['轴承滚道疲劳剥落（主因）', '润滑脂老化', '对中偏差'],
    suggestedActions: ['72 小时内安排计划性检修，更换驱动端轴承与润滑脂', '检修前降载至 60% 运行，降低轴承受力', '复测指标：轴承温度 ≤70℃、振动 ≤4.5 mm/s'],
    diagnosedAt: ago(4), modelVersion: 'diag-bearing-v2.3', advanceNoticeHours: 36,
  },
  {
    id: 'DG-20260921-003', deviceId: 'AC-01',
    conclusion: 'AC-01 运行点逼近喘振边界，当前裕度 8.6%，低于安全阈值 10%。本站为定压母管系统，负荷突增时该机易先进入喘振区。',
    evidence: [
      '喘振边界模型：机前压力 0.82 bar、导叶开度 62% 时，喘振点流量 201 m³/min，当前流量 187 m³/min',
      '防喘阀开度 12%，回流内循环使功率损失约 3.1%',
      '近 7 日裕度从 14.2% 收窄至 8.6%，与滤网压差上升相关（4.2 kPa，建议值 ≤4.0 kPa）',
    ],
    riskLevel: 'high', possibleCauses: ['进口滤网堵塞导致吸入流量下降', '管网阻力上升', '导叶执行器偏差'],
    suggestedActions: ['立即执行：提高防喘振控制器裕度设定至 12%', ' 8 小时内安排清理或更换进口滤网', '负荷调度避开 AC-01 低流量工况，必要时停机防喘振联锁自检'],
    diagnosedAt: ago(2), modelVersion: 'surge-guard-v3.1', advanceNoticeHours: 0,
  },
]
export const DIAGNOSIS_MAP = Object.fromEntries(DIAGNOSES.map(d => [d.id, d]))

// ================= 工单 =================
export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-20260905-001', deviceId: 'AC-05', title: 'AC-05 三级冷却器芯更换（计划性大修）',
    description: '三级冷却器端差持续 >12℃，冷却效率下降，按计划进行大修更换冷却器芯并做整机性能复测。',
    priority: 'medium', status: 'closed', assignee: '赵勇', plannedAt: agoD(26),
    repairRecord: '09-05 拆检确认冷却器芯结垢；09-08 更换三级冷却器芯并试压合格；09-09 整机加载测试正常。',
    spareParts: [{ name: '三级冷却器芯', spec: 'HC-C1100 原厂件', qty: 1 }, { name: '密封垫片套件', spec: '标准套件', qty: 1 }],
    retestMetrics: [
      { name: '冷却器端差', before: '12.4℃', after: '6.8℃', pass: true },
      { name: '满载比功率', before: '0.1162', after: '0.1098', pass: true },
      { name: '振动速度', before: '2.9 mm/s', after: '2.6 mm/s', pass: true },
    ],
    acceptance: '复测三项指标全部合格，试运行 24 小时无异常，验收通过。', createdAt: agoD(28), closedAt: agoD(20), source: 'manual',
  },
  {
    id: 'WO-20260920-002', deviceId: 'AC-02', title: 'AC-02 驱动端轴承温度/振动异常检修',
    description: '振动 7 日上升 62%，轴承温度 88℃ 超阈值。诊断为轴承磨损早期（DG-20260921-002），计划更换驱动端轴承并复测。',
    priority: 'critical', status: 'retest_pending', assignee: '刘强', plannedAt: DEMO_NOW.add(1, 'day').format('YYYY-MM-DD'),
    repairRecord: '已完成驱动端轴承拆除，发现滚道轻微剥落；新轴承已就位，等待班后停机窗口安装并复测。',
    spareParts: [{ name: '驱动端轴承', spec: 'SKF 22220 E', qty: 1 }, { name: '高温润滑脂', spec: 'LGHP 2/1kg', qty: 2 }],
    retestMetrics: [
      { name: '轴承温度', before: '88℃', after: '69℃', pass: true },
      { name: '振动速度', before: '6.8 mm/s', after: '3.8 mm/s', pass: true },
      { name: '油压', before: '0.29 bar', after: '0.31 bar', pass: true },
    ],
    acceptance: '', createdAt: ago(28), source: 'alert', relatedAlertId: 'AL-20260919-005', relatedDiagnosisId: 'DG-20260921-002',
  },
  {
    id: 'WO-20260921-003', deviceId: 'AC-01', title: 'AC-01 进口滤网清理与防喘阀校验',
    description: '滤网压差 4.2 kPa 超建议值，喘振裕度收窄至 8.6%（DG-20260921-003）。安排滤网清理并校验防喘阀与导叶执行器。',
    priority: 'high', status: 'created', assignee: '', plannedAt: DEMO_NOW.add(8, 'hour').format('YYYY-MM-DD HH:00'),
    repairRecord: '', spareParts: [{ name: '进口滤网', spec: 'HC-C1600 标准滤芯', qty: 1 }], retestMetrics: [],
    acceptance: '', createdAt: ago(2), source: 'diagnosis', relatedDiagnosisId: 'DG-20260921-003',
  },
]

// ================= 调度方案 =================
/**
 * 方案批次一（已完成闭环）：PLAN-20260919 批次，稳供前提下节能，已执行+复盘。
 * 方案二（异常闭环）：PLAN-20260920-002 下发时 AC-04 回执超时 → 状态未知。
 * 当前待审批：PLAN-20260921 批次候选方案。
 */
export const PLANS: SchedulePlan[] = [
  {
    id: 'PLAN-20260919-001', name: '09-19 早高峰机组组合优化', strategy: 'balanced', status: 'reviewed',
    createdAt: ago(56), effectiveFrom: ago(54), durationHours: 10,
    actions: [
      { deviceId: 'AC-03', action: 'stop', reason: 'AC-03 长期 32% 低载运行，比功率 7.63 kW/(m³/min) 较本机最优偏高 23%，改由 AC-04 经济承载' },
      { deviceId: 'AC-04', action: 'start', targetLoadRate: 68, reason: 'AC-04 螺杆机在 60%~75% 区间比功率最优（5.94），替代 AC-03 低效出力' },
      { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 85, reason: '抬升 AC-01 至高效区（75%~85%），减少防喘回流损失' },
      { deviceId: 'AC-02', action: 'adjust_load', targetLoadRate: 70, reason: 'AC-02 保持中载，兼顾轴承温度控制；夜间时段停机轮换休整' },
    ],
    expectedEnergyKwh: 21432, baselineEnergyKwh: 22796, expectedSavingsPct: 6.0, expectedPressureQualifyPct: 99.7,
    risks: { surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: 'AC-04 启动爬坡 6 分钟内母管压力短暂回落 0.03 bar，仍在合格带内' },
    explanation: [
      '负荷预测：日间 4h 用气量由 330 上升至 385 m³/min（三车间批次投料），夜间 6h 低谷负荷约 280 m³/min',
      'AC-03 加载率仅 32%，比功率 7.63 kW/(m³/min) 较本机最优 6.19 偏高 23%，是当前最大低效点；由 AC-04（最优比功率 5.94）承接更经济',
      'AC-01 抬升到 85% 后进入比功率最优区，且防喘阀回流损失从 3.1% 降至 1.2%',
      '夜间低谷（23:00-05:00）停运 AC-02/AC-03，由 AC-01（92%）+AC-04（88%）覆盖，消除两台机组待机空载损耗',
      '压力带控制 0.78~0.84 bar，兼顾三车间敏感工段压力要求',
    ],
    evidencePeriod: `${ago(72)} ~ ${ago(0)}（30 天时序 + 近 7 日负荷特性）`, createdBy: 'Agent 调度引擎 v1.2',
    approvedBy: '张伟', approvedAt: ago(53), batchId: 'B-20260919',
    receipts: [
      { deviceId: 'AC-03', command: '停机', result: 'success', message: '正常卸载停机，系统状态确认', latencyMs: 1240, finishedAt: ago(53.9) },
      { deviceId: 'AC-04', command: '启动并加载至 68%', result: 'success', message: '启动成功，加载到位', latencyMs: 6120, finishedAt: ago(53.8) },
      { deviceId: 'AC-01', command: '加载率调整至 85%', result: 'success', message: '导叶开度调节完成', latencyMs: 2100, finishedAt: ago(53.7) },
      { deviceId: 'AC-02', command: '加载率调整至 70%（夜间按时序停机）', result: 'success', message: '调节完成，夜间停机指令按时序执行', latencyMs: 1980, finishedAt: ago(53.7) },
    ],
    review: {
      energySavingKwh: 1286, energySavingPct: 5.6, pressureQualifyPct: 99.7, loadRateDeviationPct: 4.2,
      baselineEnergyKwh: 22796, actualEnergyKwh: 21510, period: `${ago(54)} ~ ${ago(44)}`,
      savingsAmountYuan: 1029, replayOnly: false, credibility: '基于执行时段实测功率积分与同工况人工基线模型对比，电表与流量计数据完整率 99.2%，可信度：高',
    },
  },
  {
    id: 'PLAN-20260920-002', name: '09-20 夜间低谷机组轮换', strategy: 'energy', status: 'unknown',
    createdAt: ago(30), effectiveFrom: ago(29), durationHours: 6,
    actions: [
      { deviceId: 'AC-02', action: 'stop', reason: '夜间低谷负荷约 280 m³/min，AC-01+AC-04 组合可覆盖且更高效' },
      { deviceId: 'AC-03', action: 'stop', reason: '消除夜间低载空转损耗' },
      { deviceId: 'AC-04', action: 'start', targetLoadRate: 88, reason: '承接 AC-02/AC-03 停机后负荷缺口' },
      { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 92, reason: '主承载机组提至高效大流量区' },
    ],
    expectedEnergyKwh: 11350, baselineEnergyKwh: 12744, expectedSavingsPct: 10.9, expectedPressureQualifyPct: 99.6,
    risks: { surgeRisk: 'none', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: '低谷负荷平稳，压力风险低' },
    explanation: ['夜间 23:00-05:00 平均负荷约 280 m³/min，AC-01（92%，产气 221）+AC-04（88%，产气 53）组合产气约 274 m³/min，储气罐微调补足',
      '停运 AC-02/AC-03 消除夜间待机空载损耗，AC-02 停机兼顾轴承冷却，配合次日检修窗口'],
    evidencePeriod: `${ago(96)} ~ ${ago(24)}（近 4 日夜间负荷段）`, createdBy: 'Agent 调度引擎 v1.2',
    approvedBy: '李静', approvedAt: ago(29.5), batchId: 'B-20260920',
    receipts: [
      { deviceId: 'AC-02', command: '停机', result: 'success', message: '正常停机', latencyMs: 1320, finishedAt: ago(29.4) },
      { deviceId: 'AC-04', command: '加载率调整至 74%', result: 'timeout', message: '控制网关未在 10s 内返回回执，执行状态未知；现场反馈 AC-04 仍在待机状态', latencyMs: 10000, finishedAt: ago(29.3) },
    ],
  },
  {
    id: 'PLAN-20260921-101', name: '09-21 早高峰候选方案 A（稳供优先）', strategy: 'stability', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-05', action: 'start', targetLoadRate: 55, reason: '提前结束大修（剩余工序可延后），以最大冗余保障早高峰' },
      { deviceId: 'AC-03', action: 'stop', reason: '低载无有效出力，停机消除低效损耗' },
      { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 78, reason: '保持喘振裕度优先，仅微调' },
    ],
    expectedEnergyKwh: 11076, baselineEnergyKwh: 10839, expectedSavingsPct: -2.2, expectedPressureQualifyPct: 99.9,
    risks: { surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'medium', pressureRiskText: '机组冗余最大（在线产能 405 m³/min，高于峰值需求 5%），压力合格率预期最高' },
    explanation: [
      '以供气冗余为第一目标：AC-05 提前复役（55%，产气 88），AC-01（78%，产气 187）+AC-02（65%，产气 130），在线产能 405 m³/min，高出峰值需求 385 约 5%',
      '任一机组异常均不影响供气，压力合格率预期 99.9%',
      'AC-01 仅微调，喘振裕度从 8.6% 恢复到 11.4%',
      '代价：AC-05 复役增加 666 kW 基荷，同产气口径能耗高于人工基线 2.2%，该时段收益为负，仅建议在高风险场景选用',
    ],
    evidencePeriod: `${ago(72)} ~ ${ago(0)}`, createdBy: 'Agent 调度引擎 v1.2', batchId: 'B-20260921',
  },
  {
    id: 'PLAN-20260921-102', name: '09-21 早高峰候选方案 B（稳供前提下节能·推荐）', strategy: 'balanced', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-03', action: 'stop', reason: 'AC-03 当前加载率 32%，比功率 7.63 较最优偏高 23%，为最大低效点；停机消除"大马拉小车"工况' },
      { deviceId: 'AC-04', action: 'start', targetLoadRate: 68, reason: 'AC-04 比功率 5.94 为全站最优，68% 加载率处于最优效率区，承接停机缺口' },
      { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 85, reason: '进入 75%~85% 比功率最优区（产气 204），喘振裕度维持 10.2%（高于安全阈值 10%）' },
      { deviceId: 'AC-02', action: 'adjust_load', targetLoadRate: 70, reason: '降载至 70%（产气 140）减小轴承受力，等待明日检修' },
    ],
    expectedEnergyKwh: 10080, baselineEnergyKwh: 10300, expectedSavingsPct: 2.1, expectedPressureQualifyPct: 99.6,
    risks: { surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: 'AC-04 启动爬坡约 6 分钟，期间母管压力预计最低 0.786 bar（合格带 ≥0.78 bar），建议提前 10 分钟启机' },
    explanation: [
      '负荷预测：未来 4 小时用气量 330→385 m³/min（置信区间 ±5%），依据近 30 天同时段负荷特征 + 三车间排产计划',
      '当前短板：AC-03 以 32% 加载率运行，仅出力 12.8 m³/min 却消耗 101 kW，比功率 7.63 kW/(m³/min) 偏高 23%，是"大马拉小车"典型工况',
      '组合校核：AC-01（85%，产气 204）+AC-02（70%，产气 140）+AC-04（68%，产气 41）= 385 m³/min，恰好覆盖峰值需求；总功率 2520 kW',
      '同产气口径对比人工基线（AC-02 拉至 88% 补量、AC-03 继续低载）：预计节能 2.1%，4h 节电约 220 kWh、约 176 元',
      '喘振防护：AC-01 流量保持在喘振边界右侧 10.2% 裕度，同时建议 8 小时内更换进口滤网（关联工单 WO-20260921-003）',
      '设备健康：AC-02 降载运行降低轴承负荷，与 WO-20260920-002 检修计划衔接',
    ],
    evidencePeriod: `${ago(72)} ~ ${ago(0)}（30 天时序 + 近 7 日负荷特性 + 排产计划）`, createdBy: 'Agent 调度引擎 v1.2', batchId: 'B-20260921',
  },
  {
    id: 'PLAN-20260921-103', name: '09-21 早高峰候选方案 C（设备保护优先）', strategy: 'protection', status: 'pending_approval',
    createdAt: ago(1), effectiveFrom: DEMO_NOW.add(1, 'hour').format('YYYY-MM-DD HH:00'), durationHours: 4,
    actions: [
      { deviceId: 'AC-02', action: 'stop', reason: '轴承温度 88℃ 持续偏高，优先停机保护，等待明日检修' },
      { deviceId: 'AC-03', action: 'stop', reason: '低载无有效出力，停机消除低效损耗' },
      { deviceId: 'AC-05', action: 'start', targetLoadRate: 70, reason: 'AC-05 复役承接 AC-02 停机缺口（产气 112）' },
      { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 85, reason: '最大化喘振裕度至 13.5%（产气 204）' },
      { deviceId: 'AC-04', action: 'start', targetLoadRate: 85, reason: 'AC-04 补足剩余缺口（产气 51）' },
    ],
    expectedEnergyKwh: 9832, baselineEnergyKwh: 10300, expectedSavingsPct: 0.1, expectedPressureQualifyPct: 98.9,
    risks: { surgeRisk: 'none', overloadRisk: 'medium', healthRisk: 'low', pressureRiskText: '在线产能 367 m³/min 低于峰值需求 385 约 4.7%，需储气罐调节与错峰配合，压力合格率预期 98.9%（低于 99.5% 目标）' },
    explanation: [
      '以设备保护为第一目标：AC-02 立即停机消除轴承恶化风险，AC-01 提至 85% 保持最大喘振裕度 13.5%',
      'AC-05 提前复役承担主要缺口，AC-04 高位补足',
      '代价：在线产能低于峰值需求 4.7%，压力合格率预期 98.9%，低于 99.5% 目标，需产线错峰配合',
      '适用场景：若轴承温度继续上升至 92℃ 或振动 >7.5 mm/s，建议切换本方案',
    ],
    evidencePeriod: `${ago(72)} ~ ${ago(0)} + 诊断报告 DG-20260921-002/003`, createdBy: 'Agent 调度引擎 v1.2', batchId: 'B-20260921',
  },
]

// ================= 策略版本 =================
export const STRATEGIES: StrategyVersion[] = [
  {
    id: 'STG-V1.1.0', version: 'V1.1.0', name: '基础稳供策略', status: 'archived',
    description: '初始版本：固定压力带 0.75~0.85 bar，按额定功率顺序启停，无健康度约束。',
    params: { minLoadRatePct: 40, maxLoadRatePct: 95, pressureBandBar: [0.75, 0.85], surgeMarginPct: 8, priority: 'stability', autoLearnEnabled: false },
    createdAt: '2026-08-01 10:00:00', createdBy: '陈明', releasedAt: '2026-08-01 10:30:00', rolledBackAt: '2026-08-20 15:00:00',
  },
  {
    id: 'STG-V1.2.0', version: 'V1.2.0', name: '能效优先 + 健康约束策略', status: 'active',
    description: '当前生效版本：负荷预测驱动的组合寻优，压力带收窄至 0.78~0.84 bar，叠加设备健康度与喘振裕度约束，人工审批后下发。',
    params: { minLoadRatePct: 55, maxLoadRatePct: 85, pressureBandBar: [0.78, 0.84], surgeMarginPct: 10, priority: 'balanced', autoLearnEnabled: true },
    createdAt: '2026-08-20 14:00:00', createdBy: '陈明', releasedAt: '2026-08-20 15:00:00',
    replay: { period: '2026-08-06 ~ 2026-08-19', energySavingPct: 6.4, pressureQualifyPct: 99.7, loadRateDeviationPct: 5.1, verdict: 'pass', notes: '14 天历史回放：能效提升 6.4%，压力合格率 99.7%，加载率偏离 5.1%，通过验证' },
  },
  {
    id: 'STG-V1.3.0-C', version: 'V1.3.0-候选', name: '自适应学习策略（含低载识别与轮换休整）', status: 'replay_passed',
    description: '基于近 14 天人工修改与执行效果的候选版本：新增低加载率自动识别（<50% 持续 2h 触发重组）、机组轮换休整、喘振裕度动态化。已完成 14 天历史回放验证，待管理员审批发布。',
    params: { minLoadRatePct: 50, maxLoadRatePct: 82, pressureBandBar: [0.78, 0.83], surgeMarginPct: 10, priority: 'balanced', autoLearnEnabled: true },
    createdAt: ago(20), createdBy: 'Agent 策略学习引擎',
    baseOnVersion: 'V1.2.0',
    replay: { period: `${ago(14)} ~ ${ago(0)}`, energySavingPct: 7.3, pressureQualifyPct: 99.6, loadRateDeviationPct: 3.8, verdict: 'pass', notes: '回放结果：能效提升 7.3%（较 V1.2.0 +0.9pp），加载率偏离降至 3.8%，压力合格率 99.6% 达标，喘振场景 0 违例' },
  },
  {
    id: 'STG-V1.2.1-H', version: 'V1.2.1-候选', name: '设备保护优先级增强（学习自人工驳回记录）', status: 'draft',
    description: '学习来源：09-20 方案驳回原因"AC-02 轴承高温时段不宜抬升加载率"。候选改进：健康分 <75 的机组默认降载 5%，并优先安排检修衔接。',
    params: { minLoadRatePct: 55, maxLoadRatePct: 80, pressureBandBar: [0.78, 0.84], surgeMarginPct: 11, priority: 'protection', autoLearnEnabled: true },
    createdAt: ago(10), createdBy: 'Agent 策略学习引擎', baseOnVersion: 'V1.2.0',
  },
]

// ================= 数据源与数据质量 =================
export const DATA_SOURCES: DataSource[] = [
  { id: 'DS-SCADA-01', name: 'SCADA 实时库（压力/流量/功率）', protocol: 'OPC UA', endpoint: 'opc.tcp://scada-01.hchj.local:4840', status: 'online', lastSyncAt: ago(0.02), pointCount: 412, qualityPct: 99.2 },
  { id: 'DS-PLC-01', name: '机组 PLC 控制网关', protocol: 'Modbus TCP', endpoint: '192.168.10.21:502', status: 'online', lastSyncAt: ago(0.01), pointCount: 268, qualityPct: 98.6 },
  { id: 'DS-PLC-04', name: 'AC-04 控制网关', protocol: 'Modbus TCP', endpoint: '192.168.10.24:502', status: 'degraded', lastSyncAt: ago(0.3), pointCount: 54, qualityPct: 91.4 },
  { id: 'DS-VIB-01', name: '振动在线监测系统', protocol: 'REST API', endpoint: 'http://vib-01.hchj.local/api/v2', status: 'online', lastSyncAt: ago(0.1), pointCount: 96, qualityPct: 99.8 },
  { id: 'DS-EAM-01', name: 'EAM 设备资产与工单', protocol: 'REST API', endpoint: 'http://eam.hchj.local/api/v1', status: 'online', lastSyncAt: ago(1), pointCount: 34, qualityPct: 100 },
  { id: 'DS-DP-01', name: '产线排产计划（MES）', protocol: 'REST API', endpoint: 'http://mes.hchj.local/api/schedule', status: 'online', lastSyncAt: ago(2), pointCount: 12, qualityPct: 99.5 },
]

export const DATA_QUALITY_ISSUES: DataQualityIssue[] = [
  { id: 'DQ-001', source: 'DS-DP-01', type: 'stale_data', severity: 'warning', detail: '排产计划数据最后同步于 2 小时前，负荷预测使用近 7 日同时段特征作为补充，影响较小。', detectedAt: ago(2), resolved: false, blockPlan: false },
  { id: 'DQ-002', source: 'DS-PLC-04', deviceId: 'AC-04', type: 'field_missing', severity: 'warning', detail: 'AC-04 网关"排气温度"字段缺失（固件版本低），温度保护使用机内就地表计，不影响调度主链路。', detectedAt: ago(5), resolved: false, blockPlan: false },
  { id: 'DQ-003', source: 'DS-VIB-01', deviceId: 'AC-05', type: 'no_data', severity: 'warning', detail: 'AC-05 大修期间振动通道暂停采集，健康评分按检修前快照冻结。', detectedAt: ago(26), resolved: false, blockPlan: false },
]

// ================= 成员 / 角色 =================
export const ROLE_DEFS: RoleDef[] = [
  { key: 'operator', name: '值班员', desc: '运行监视、告警处置、方案审批与指令下发（唯一可下发控制指令的业务角色）', permissions: ['view:all', 'alert:handle', 'plan:approve', 'plan:reject', 'plan:dispatch', 'todo:handle'] },
  { key: 'energy_manager', name: '能源/生产负责人', desc: '能效收益、报告与目标达成查看；只读业务，不可下发控制指令', permissions: ['view:all', 'report:export'] },
  { key: 'device_engineer', name: '设备工程师', desc: '设备健康、诊断、喘振风险查看与工单全流程处理', permissions: ['view:all', 'alert:handle', 'workorder:manage', 'workorder:close'] },
  { key: 'admin', name: '系统管理员', desc: '站点与设备档案、阈值、数据源、策略版本、成员与审计管理；不可直接下发控制指令', permissions: ['view:all', 'config:manage', 'strategy:manage', 'member:manage', 'audit:view'] },
]

export const MEMBERS: Member[] = [
  { id: 'M-001', name: '张伟', role: 'operator', account: 'zhangwei', phone: '138****2168', sites: ['AS-01'], active: true },
  { id: 'M-002', name: '李静', role: 'operator', account: 'lijing', phone: '139****5521', sites: ['AS-01'], active: true },
  { id: 'M-003', name: '王芳', role: 'energy_manager', account: 'wangfang', phone: '137****8834', sites: ['AS-01'], active: true },
  { id: 'M-004', name: '刘强', role: 'device_engineer', account: 'liuqiang', phone: '136****9027', sites: ['AS-01'], active: true },
  { id: 'M-005', name: '赵勇', role: 'device_engineer', account: 'zhaoyong', phone: '135****4413', sites: ['AS-01'], active: true },
  { id: 'M-006', name: '陈明', role: 'admin', account: 'chenming', phone: '138****7745', sites: ['AS-01'], active: true },
]

// ================= 审计日志（预置） =================
export const AUDIT_LOGS: AuditLog[] = [
  { id: 'LOG-9001', time: ago(56), actor: '系统', role: 'admin', action: '策略发布', target: 'V1.2.0', detail: 'V1.2.0 策略回放验证通过后发布生效', result: 'success' },
  { id: 'LOG-9002', time: ago(53.9), actor: '张伟', role: 'operator', action: '调度下发', target: 'PLAN-20260919-001', detail: '4 台设备指令全部成功下发，逐台回执确认', result: 'success' },
  { id: 'LOG-9003', time: ago(30), actor: '李静', role: 'operator', action: '方案审批', target: 'PLAN-20260920-002', detail: '批准 09-20 夜间轮换方案', result: 'success' },
  { id: 'LOG-9004', time: ago(29.3), actor: '系统', role: 'admin', action: '执行回执超时', target: 'AC-04', detail: '控制网关 10s 未回执，方案标记为"状态未知"，已创建异常待办', result: 'success' },
  { id: 'LOG-9005', time: ago(10), actor: '王芳', role: 'energy_manager', action: '调度下发（越权尝试）', target: 'PLAN-20260920-002', detail: '能源负责人无控制下发权限，系统拒绝并生成审计记录', result: 'denied' },
  { id: 'LOG-9006', time: ago(8), actor: '刘强', role: 'device_engineer', action: '工单复测提交', target: 'WO-20260920-002', detail: '提交 AC-02 轴承更换后复测数据：温度 69℃/振动 3.8mm/s，合格', result: 'success' },
]

// ================= 待办（预置） =================
export const TODOS: TodoItem[] = [
  { id: 'TD-001', kind: 'plan_approval', title: '3 套早高峰调度方案待审批', detail: '批次 B-20260921：稳供优先 / 稳供前提下节能（推荐）/ 设备保护优先，请比较后审批或驳回', createdAt: ago(1), link: '/scheduling', done: false, severity: 'high', refId: 'B-20260921' },
  { id: 'TD-002', kind: 'alert_confirm', title: 'AC-02 轴承温度超阈值告警未确认', detail: '88℃ 持续 4 小时，关联诊断 DG-20260921-002，建议确认后跟踪工单', createdAt: ago(4), link: '/operation', done: false, severity: 'high', refId: 'AL-20260921-002' },
  { id: 'TD-003', kind: 'alert_confirm', title: 'AC-01 喘振裕度收窄告警未确认', detail: '裕度 8.6% 低于安全阈值 10%，建议确认并安排滤网清理', createdAt: ago(2), link: '/operation', done: false, severity: 'high', refId: 'AL-20260921-003' },
  { id: 'TD-004', kind: 'alert_confirm', title: 'AC-03 低加载率异常待确认', detail: '近 72h 平均加载率 31.5%，"大马拉小车"工况', createdAt: ago(6), link: '/operation', done: false, severity: 'medium', refId: 'AL-20260921-001' },
  { id: 'TD-005', kind: 'workorder', title: '工单 WO-20260921-003 待指派', detail: 'AC-01 进口滤网清理与防喘阀校验，高优先级', createdAt: ago(2), link: '/health', done: false, severity: 'medium', refId: 'WO-20260921-003' },
  { id: 'TD-006', kind: 'workorder', title: '工单 WO-20260920-002 待复测验收', detail: 'AC-02 轴承检修已完成，复测数据合格，待设备工程师验收关闭', createdAt: ago(8), link: '/health', done: false, severity: 'medium', refId: 'WO-20260920-002' },
  { id: 'TD-007', kind: 'execution_abnormal', title: '方案 PLAN-20260920-002 执行状态未知', detail: 'AC-04 回执超时，需人工现场核实后选择"重新下发"或"人工处置"关闭', createdAt: ago(29.3), link: '/execution', done: false, severity: 'high', refId: 'PLAN-20260920-002' },
  { id: 'TD-008', kind: 'strategy_release', title: '策略候选版本 V1.3.0 待发布审批', detail: '历史回放验证通过（能效 +7.3%），请审批发布或驳回', createdAt: ago(20), link: '/data-strategy', done: false, severity: 'medium', refId: 'STG-V1.3.0-C' },
  { id: 'TD-009', kind: 'data_quality', title: 'DR-01 露点数据更新延迟', detail: '数据陈旧 2.1 小时，请通知仪表班检查，确认后可关闭', createdAt: ago(9), link: '/data-strategy', done: false, severity: 'low', refId: 'DQ-001' },
  { id: 'TD-010', kind: 'energy_deviation', title: '本月节能收益偏差 -0.8pp', detail: '月累计能效提升 5.7%，低于目标 6%，主要受 09-15 基线偏移影响，请查看收益明细', createdAt: ago(12), link: '/energy', done: false, severity: 'low', refId: 'TD-010' },
]

// ================= 月度报告（预置） =================
export const MONTHLY_REPORT: MonthlyReport = {
  id: 'RPT-202609', title: '2026-09 空压站能效月报（模拟数据）', month: '2026-09', generatedAt: ago(3),
  dataRange: '2026-09-01 ~ 2026-09-20（运行数据），基线对比期 2026-08-22 ~ 2026-08-31',
  replayOnly: true,
  metrics: [
    { name: '系统综合能效提升率', value: '6.3%', baseline: '基线 0.1118 kWh/m³（08-22~08-31 人工调度期）', note: 'AI 调度期实测系统比功率 0.1047 kWh/m³，计算式 (0.1118-0.1047)/0.1118=6.3%' },
    { name: '供气压力合格率', value: '99.6%', baseline: '目标 ≥99.5%', note: '合格带 0.78~0.84 bar，统计自 SCADA 母管压力 1min 数据' },
    { name: '加载率偏离度', value: '4.6%', baseline: '目标 ≤±10%', note: '各机组实际加载率与方案目标值平均绝对偏差' },
    { name: '月度节电（09-01~09-20）', value: '7.36 万 kWh', baseline: '同工况人工基线模型预测用电', note: '折合电费约 5.89 万元（电价 0.8 元/kWh）；日间方案贡献约 40%，夜间轮换与低载治理贡献约 60%；按当前趋势年化节电约 129 万 kWh、约 103 万元（年用电成本降低约 6.5%）' },
    { name: '"大马拉小车"工况时长', value: '下降 63%', baseline: '基线期日均 6.8h → 当前 2.5h', note: '加载率 <50% 且功率 >30% 额定的时长统计' },
    { name: '非计划停机', value: '0 次', baseline: '基线期 2 次', note: '预测性维护提前干预 AC-02 轴承问题' },
  ],
}
