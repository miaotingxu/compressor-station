// 主办方真实数据集的类型化封装。
// 数据由 scripts/build_real_dataset.py 从 9 个主办方数据文件预处理生成，
// 输出到 public/data/realDataset.json，由 main.tsx 在启动时 fetch 并注入 window。
// 替换数据包只需覆盖该 JSON，无需重新构建。

export interface RealDeviceSeed {
  id: string
  name: string
  kind: 'centrifugal' | 'screw'
  brand: string
  model: string
  code: string
  ratedPowerKw: number
  ratedFlowM3Min: number
  ratedPressureBar: number
  ratedSpecificPower: number
  status: 'running' | 'standby' | 'maintenance' | 'fault'
  loadRate: number
  pressureBar: number
  flowM3Min: number
  powerKw: number
  igvPct: number
  bovPct: number
  healthScore: number
  surgeRisk: 'none' | 'low' | 'medium' | 'high'
  runningHours: number | null
  installedAt: string
  nextMaintenanceDueHours: number | null
  vibration: number
  bearingTempC: number
  windingTempC: number
  exhaustTempC: number
  exhaustTempPeakC: number
  currentA: number
  oilPressureBar: number
  runRatePct: number
  gatewayReliable: boolean
  maintenancePlan: { 保养项目: string; 保养周期_h: number }[]
}

export interface RealSeries {
  times: string[]
  devices: Record<string, {
    loadRate: number[]
    pressureBar: number[]
    flowM3Min: number[]
    powerKw: number[]
    currentA: number[]
    vibration: number[]
    windingTempC: number[]
    bearingTempC: number[]
    oilPressureBar: number[]
    running: number[]
  }>
  station: {
    headerPressureBar: number[]
    totalFlow: number[]
    totalPowerKw: number[]
    avgLoadRate: number[]
  }
}

export interface RealDaily {
  date: string
  powerKwh: number
  airflowKm3: number
  specificEnergy: number
  pressureQualifyPct: number
  avgLoadRatePct: number
  avgLoadDeviationPct: number
  lowLoadHours: number
  runRatePct: number
  mode: 'baseline' | 'current'
}

export interface RealHourly {
  time: string
  demandM3Min: number
  totalPowerKw: number
  headerPressureBar: number
  specificEnergy: number
  qualify: boolean
}

export interface RealRealtime {
  time: string
  pressureBar: number
  totalFlow: number
  totalPowerKw: number
  avgLoadRate: number
}

export interface RealForecast {
  time: string
  forecastM3Min: number
  upper: number
  lower: number
}

export interface RealAggregates {
  specificEnergy: number
  pressureQualifyPct: number
  loadDeviationPct: number
  lowLoadHours: number
  avgLoadRatePct: number
  runRatePct: number
}

export interface RealPoint {
  file: string
  column: string
  group: string
  device: string
  unit: string
  min: number | null
  mean: number | null
  max: number | null
  latest: number | null
  coveragePct: number
}

export interface RealAsset {
  file: string
  kind: string
  group: string
  rows: number
  fields: number
  rangeStart: string
  rangeEnd: string
}

export interface RealQualityIssue {
  source: string
  metric: string
  type: string
  severity: 'warning' | 'critical'
  detail: string
}

export interface RealData {
  meta: {
    source: string
    generatedAt: string
    rangeStart: string
    rangeEnd: string
    rows: number
    ratedTotalFlow: number
    ratedFlowPerUnit: number
    ratedPressureBar: number
    ratedPower: number
    ratedSpecificPower: number
    pressureBandBar: [number, number]
    midpoint: string
  }
  devices: RealDeviceSeed[]
  daily: RealDaily[]
  hourly: RealHourly[]
  realtime: RealRealtime[]
  forecast: RealForecast[]
  metrics: {
    baseline: RealAggregates
    current: RealAggregates
    loadLevelDist: { low: number; mid: number; high: number }
    pressureStd: { baseline: number; current: number }
  }
  quality: RealQualityIssue[]
  events: { time: string; device: string; to: 'running' | 'stop' }[]
  maint: { device: string; totalRunHours: number | null; totalLoadHours: number | null; nextMaintenanceDueHours: number | null }[]
  series: RealSeries
  points: RealPoint[]
  assets: RealAsset[]
}

const injected = (globalThis as Record<string, unknown>).__REAL_DATASET__
if (!injected) {
  throw new Error('真实数据集未加载：请确认 public/data/realDataset.json 可访问。')
}
export const REAL = injected as unknown as RealData
