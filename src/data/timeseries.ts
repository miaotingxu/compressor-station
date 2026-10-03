// 时序数据层：全部来自真实数据包，由 scripts/build_real_dataset.py 聚合生成。
// 说明：真实数据为 2026-03-12 ~ 2026-09-12 的固定历史归档（分钟级），
//       程序原先假设的「实时刷新 / AI 调度前后对比」在该数据上并不成立，
//       此处以数据中点为界，前半段作为「基线期」、后半段作为「近期期」进行对比。
import dayjs from 'dayjs'
import type { EnergyRecord } from '../types'
import { REAL } from './realDataset'

export const REAL_NOW = dayjs(REAL.meta.rangeEnd)

/** 数据分界日：之前为基线期，之后为近期期 */
export const AI_START = dayjs(REAL.meta.midpoint)

export interface HourPoint {
  time: string
  demandM3Min: number
  totalPowerKw: number
  headerPressureBar: number
  specificEnergy: number
  mode: 'baseline' | 'ai'
  qualify: boolean
}

/** 最近 30 天小时级时序（真实数据） */
export const HISTORY_30D: HourPoint[] = REAL.hourly.map(h => ({
  time: h.time,
  demandM3Min: h.demandM3Min,
  totalPowerKw: h.totalPowerKw,
  headerPressureBar: h.headerPressureBar,
  specificEnergy: h.specificEnergy,
  mode: dayjs(h.time).isBefore(AI_START) ? 'baseline' : 'ai',
  qualify: h.qualify,
}))

/** 6 个月能效日汇总（真实数据） */
export const ENERGY_DAILY: EnergyRecord[] = REAL.daily.map(d => ({
  date: d.date,
  specificEnergy: d.specificEnergy,
  powerKwh: d.powerKwh,
  airflowKm3: d.airflowKm3,
  pressureQualifyPct: d.pressureQualifyPct,
  avgLoadDeviationPct: d.avgLoadDeviationPct,
  lowLoadHours: d.lowLoadHours,
  mode: d.mode === 'current' ? 'ai' : 'baseline',
}))

/** 基线期汇总（真实数据前半年） */
export const BASELINE_METRICS = REAL.metrics.baseline

/** 近期期汇总（真实数据后半年） */
export const AI_METRICS = REAL.metrics.current

/** 未来 4 小时负荷预测（基于真实数据末尾一日同时段形态推演） */
export const LOAD_FORECAST = REAL.forecast

/** 最近 6 小时实时趋势（真实数据末尾，分钟级） */
export const REALTIME_TREND = REAL.realtime

export const loadRateDeviationCurrent = REAL.metrics.current.loadDeviationPct
