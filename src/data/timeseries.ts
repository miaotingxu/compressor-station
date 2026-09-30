import dayjs from 'dayjs'
import type { EnergyRecord } from '../types'
import { DEMO_NOW } from './initial'

/** 伪随机（可复现） */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 近似标准正态随机（Box-Muller） */
function gaussOf(rnd: () => number) {
  const u = Math.max(1e-9, rnd())
  const v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export interface HourPoint {
  time: string
  demandM3Min: number
  totalPowerKw: number
  headerPressureBar: number
  specificEnergy: number
  mode: 'baseline' | 'ai'
  qualify: boolean
}

/** 日内负荷形状（工作日）：0-23 时需求系数 */
const DAY_SHAPE = [0.62, 0.6, 0.58, 0.58, 0.6, 0.65, 0.72, 0.85, 0.95, 1.0, 1.0, 0.97, 0.9, 0.92, 0.96, 0.98, 0.94, 0.88, 0.82, 0.76, 0.72, 0.68, 0.66, 0.64]
const PEAK = 360
const WEEKEND_FACTOR = 0.76

/** AI 调度上线分界日：15 天前 */
export const AI_START = DEMO_NOW.subtract(15, 'day').startOf('day')

/** 生成 30 天小时级历史时序（模拟数据） */
export const HISTORY_30D: HourPoint[] = (() => {
  const rnd = mulberry32(20260921)
  const points: HourPoint[] = []
  const start = DEMO_NOW.subtract(30, 'day').startOf('hour')
  const total = DEMO_NOW.diff(start, 'hour')
  for (let i = 0; i < total; i++) {
    const t = start.add(i, 'hour')
    const dow = t.day()
    const weekend = dow === 0 || dow === 6
    const hour = t.hour()
    let demand = PEAK * DAY_SHAPE[hour] * (weekend ? WEEKEND_FACTOR : 1) * (0.97 + rnd() * 0.06)
    const mode: 'baseline' | 'ai' = t.isBefore(AI_START) ? 'baseline' : 'ai'
    // 系统比功率：baseline 期约 0.112，AI 期约 0.1047（夜间与低载治理贡献更大）
    let se: number
    let pressure: number
    if (mode === 'baseline') {
      se = 0.1118 + (rnd() - 0.5) * 0.003 + (hour >= 1 && hour <= 5 ? 0.006 : 0) // 夜间空载损耗
      // σ≈0.0127 → 合格率约 99.1%（人工调度期）
      pressure = 0.81 + gaussOf(rnd) * 0.011
    } else {
      se = 0.1047 + (rnd() - 0.5) * 0.0022 + (hour >= 1 && hour <= 5 ? 0.002 : 0)
      // σ≈0.006 + 约 0.4% 事件性偏移 → 合格率约 99.6%（AI 调度期）
      pressure = 0.81 + (rnd() < 0.004 ? -0.045 : gaussOf(rnd) * 0.006)
    }
    const totalPowerKw = Math.round(demand * se * 60)
    points.push({
      time: t.format('YYYY-MM-DD HH:00:00'),
      demandM3Min: +demand.toFixed(1),
      totalPowerKw: Math.round(demand * se * 60),
      headerPressureBar: +pressure.toFixed(3),
      specificEnergy: +se.toFixed(4),
      mode,
      qualify: pressure >= 0.78 && pressure <= 0.84,
    })
  }
  return points
})()

/** 30 天能效日汇总（模拟数据） */
export const ENERGY_DAILY: EnergyRecord[] = (() => {
  const byDay = new Map<string, HourPoint[]>()
  for (const p of HISTORY_30D) {
    const d = p.time.slice(0, 10)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(p)
  }
  const rnd = mulberry32(7788)
  const records: EnergyRecord[] = []
  for (const [date, pts] of byDay) {
    const mode = pts[0].mode
    const powerKwh = pts.reduce((s, p) => s + p.totalPowerKw, 0)
    const airflowKm3 = pts.reduce((s, p) => s + p.demandM3Min * 60, 0) / 1000
    const specificEnergy = +(powerKwh / (airflowKm3 * 1000)).toFixed(4)
    const qualifyPct = +((pts.filter(p => p.qualify).length / pts.length) * 100).toFixed(2)
    const avgLoadDeviationPct = mode === 'baseline' ? +(7.5 + rnd() * 4.5).toFixed(1) : +(3.2 + rnd() * 2.6).toFixed(1)
    const lowLoadHours = mode === 'baseline' ? +(5.8 + rnd() * 2.2).toFixed(1) : +(1.9 + rnd() * 1.3).toFixed(1)
    records.push({ date, specificEnergy, powerKwh: Math.round(powerKwh), airflowKm3: +airflowKm3.toFixed(1), pressureQualifyPct: qualifyPct, avgLoadDeviationPct, lowLoadHours, mode })
  }
  return records
})()

/** 指标基线（人工调度期汇总，模拟数据） */
export const BASELINE_METRICS = (() => {
  const base = ENERGY_DAILY.filter(r => r.mode === 'baseline')
  const se = base.reduce((s, r) => s + r.specificEnergy, 0) / base.length
  const pq = base.reduce((s, r) => s + r.pressureQualifyPct, 0) / base.length
  const ld = base.reduce((s, r) => s + r.avgLoadDeviationPct, 0) / base.length
  const low = base.reduce((s, r) => s + r.lowLoadHours, 0) / base.length
  return { specificEnergy: +se.toFixed(4), pressureQualifyPct: +pq.toFixed(2), loadDeviationPct: +ld.toFixed(1), lowLoadHours: +low.toFixed(1) }
})()

/** AI 期汇总 */
export const AI_METRICS = (() => {
  const ai = ENERGY_DAILY.filter(r => r.mode === 'ai')
  const se = ai.reduce((s, r) => s + r.specificEnergy, 0) / ai.length
  const pq = ai.reduce((s, r) => s + r.pressureQualifyPct, 0) / ai.length
  const ld = ai.reduce((s, r) => s + r.avgLoadDeviationPct, 0) / ai.length
  const low = ai.reduce((s, r) => s + r.lowLoadHours, 0) / ai.length
  return { specificEnergy: +se.toFixed(4), pressureQualifyPct: +pq.toFixed(2), loadDeviationPct: +ld.toFixed(1), lowLoadHours: +low.toFixed(1) }
})()

/** 未来 4 小时负荷预测（15 分钟粒度，模拟数据） */
export const LOAD_FORECAST = (() => {
  const rnd = mulberry32(333)
  const pts: { time: string; forecastM3Min: number; upper: number; lower: number }[] = []
  const start = DEMO_NOW.startOf('hour').add(15, 'minute')
  for (let i = 0; i < 16; i++) {
    const t = start.add(i * 15, 'minute')
    const hour = t.hour() + t.minute() / 60
    const idx = Math.floor(hour)
    const frac = hour - idx
    const shape = DAY_SHAPE[idx % 24] * (1 - frac) + DAY_SHAPE[(idx + 1) % 24] * frac
    // 早高峰突增场景：未来 1~3 小时爬升至峰值
    const surge = i >= 4 && i <= 12 ? 1.06 + (i - 4) * 0.008 : 1.0
    const v = PEAK * shape * surge * (0.99 + rnd() * 0.02)
    pts.push({
      time: t.format('HH:mm'),
      forecastM3Min: +v.toFixed(0),
      upper: +(v * 1.05).toFixed(0),
      lower: +(v * 0.95).toFixed(0),
    })
  }
  return pts
})()

/** 最近 6 小时实时趋势（10 分钟粒度，模拟数据） */
export const REALTIME_TREND = (() => {
  const rnd = mulberry32(999)
  const pts: { time: string; pressureBar: number; totalFlow: number; totalPowerKw: number; avgLoadRate: number }[] = []
  const start = DEMO_NOW.subtract(6, 'hour').startOf('hour')
  const n = DEMO_NOW.diff(start, 'minute')
  for (let m = 0; m <= n; m += 10) {
    const t = start.add(m, 'minute')
    const hour = t.hour() + t.minute() / 60
    const idx = Math.floor(hour)
    const frac = hour - idx
    const shape = DAY_SHAPE[idx % 24] * (1 - frac) + DAY_SHAPE[(idx + 1) % 24] * frac
    const flow = PEAK * shape * (0.98 + rnd() * 0.04)
    const power = flow * 0.1047 * 60 * (0.99 + rnd() * 0.02)
    const loadRates = [78, 65, 32, 0, 0]
    const avg = 58.3 + (rnd() - 0.5) * 4
    pts.push({
      time: t.format('HH:mm'),
      pressureBar: +(0.806 + (rnd() - 0.5) * 0.03).toFixed(3),
      totalFlow: +flow.toFixed(0),
      totalPowerKw: Math.round(power),
      avgLoadRate: +avg.toFixed(1),
    })
  }
  return pts
})()

export const loadRateDeviationCurrent = 4.6
