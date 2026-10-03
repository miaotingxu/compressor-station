// 站点单一配置源：站点信息、额定参数、阈值、负荷口径。
// 页面与算法统一从这里取值，避免机组编号、阈值、单位口径散落硬编码。
import { REAL } from './realDataset'

export const STATION = {
  factory: '主办方空压站',
  name: '1 号空压站',
  id: 'AS-01',
  region: '真实数据集',
  rangeStart: REAL.meta.rangeStart,
  rangeEnd: REAL.meta.rangeEnd,
  midpoint: REAL.meta.midpoint,
  rows: REAL.meta.rows,
  /** 单机额定气量 m³/min */
  ratedFlowPerUnit: REAL.meta.ratedFlowPerUnit,
  /** 站点额定总流量 m³/min */
  ratedTotalFlow: REAL.meta.ratedTotalFlow,
  /** 额定排气压力 bar */
  ratedPressureBar: REAL.meta.ratedPressureBar,
  /** 单机额定功率 kW */
  ratedPower: REAL.meta.ratedPower,
  /** 额定比功率 kW/(m³/min) */
  ratedSpecificPower: REAL.meta.ratedSpecificPower,
  /** 母管压力合格带 bar */
  pressureBandBar: REAL.meta.pressureBandBar as [number, number],
  /** 机组编号清单（顺序即展示顺序） */
  compressorIds: REAL.devices.map(d => d.id),
} as const

/** 压力单位口径：真实数据源为 MPa，站点内统一以 bar 存储与展示（1 MPa = 10 bar）。 */
export const PRESSURE_UNIT = { source: 'MPa', display: 'bar', factor: 10 } as const

/** 健康判定阈值（统一来源） */
export const HEALTH_THRESHOLDS = {
  vibrationWarn: 7.1, // ISO 10816 C 区下限 mm/s
  vibrationAlarm: 11.2, // D 区下限
  windingWarn: 95, // 电机绕组温度 ℃
  windingAlarm: 110,
  bearingWarn: 85, // 轴承温度 ℃
  bearingAlarm: 95,
  exhaustWarn: 100, // 排气温度 ℃
  exhaustAlarm: 110,
  oilPressureLow: 1.5, // 变速箱油压 bar
} as const

/** 喘振风险判定：依据 BOV 闭度（闭度越低，回流越多，越接近喘振） */
export const SURGE_THRESHOLDS = {
  high: 20,
  medium: 50,
  low: 80,
} as const

/** 负荷口径 */
export const LOAD = {
  /** 低载判定阈值（"大马拉小车"） */
  lowLoadPct: 50,
  /** 经济运行下沿 */
  economicLowPct: 65,
  /** 经济运行上沿 */
  economicHighPct: 92,
  /** 偏离考核目标 */
  targetPct: 80,
} as const

export const isCompressorId = (id: string) => STATION.compressorIds.includes(id)
