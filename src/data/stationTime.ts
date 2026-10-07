// 站点时间轴：在真实历史数据上做时间定位与回放采样。
// 取代原先"以应用加载时刻为基准 + 随机抖动伪造实时"的做法。
import dayjs from 'dayjs'
import { REAL } from './realDataset'
import { STATION } from './stationConfig'

const TIMES = REAL.series.times

export interface StationSample {
  time: string
  headerPressureBar: number
  totalFlow: number
  totalPowerKw: number
  avgLoadRate: number
}

export interface DeviceSample {
  id: string
  loadRate: number
  pressureBar: number
  flowM3Min: number
  powerKw: number
  currentA: number
  vibration: number
  windingTempC: number
  bearingTempC: number
  oilPressureBar: number
  running: boolean
}

/** 二分查找：返回不晚于 timeStr 的最近小时下标 */
export function nearestIndex(timeStr: string): number {
  const target = dayjs(timeStr).format('YYYY-MM-DD HH:00:00')
  let lo = 0
  let hi = TIMES.length - 1
  if (target <= TIMES[0]) return 0
  if (target >= TIMES[hi]) return hi
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (TIMES[mid] === target) return mid
    if (TIMES[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, hi)
}

export function clampToRange(timeStr: string): string {
  const t = dayjs(timeStr)
  if (t.isBefore(dayjs(STATION.rangeStart))) return STATION.rangeStart
  if (t.isAfter(dayjs(STATION.rangeEnd))) return STATION.rangeEnd
  return t.format('YYYY-MM-DD HH:mm:ss')
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f

/**
 * 在真实小时序列上做线性插值采样，支持按分钟平滑推进（用于实时监控）。
 */
export function sampleInterpolated(timeStr: string): { station: StationSample; devices: DeviceSample[] } {
  const target = dayjs(timeStr)
  const i = nearestIndex(timeStr)
  const j = Math.min(i + 1, TIMES.length - 1)
  const t0 = dayjs(TIMES[i])
  const t1 = dayjs(TIMES[j])
  const span = Math.max(1, t1.diff(t0, 'minute'))
  const f = Math.min(1, Math.max(0, target.diff(t0, 'minute') / span))

  const st = REAL.series.station
  const station: StationSample = {
    time: target.format('YYYY-MM-DD HH:mm:00'),
    headerPressureBar: +lerp(st.headerPressureBar[i], st.headerPressureBar[j], f).toFixed(2),
    totalFlow: +lerp(st.totalFlow[i], st.totalFlow[j], f).toFixed(1),
    totalPowerKw: Math.round(lerp(st.totalPowerKw[i], st.totalPowerKw[j], f)),
    avgLoadRate: +lerp(st.avgLoadRate[i], st.avgLoadRate[j], f).toFixed(1),
  }
  const devices = Object.entries(REAL.series.devices).map(([id, d]) => ({
    id,
    loadRate: +lerp(d.loadRate[i], d.loadRate[j], f).toFixed(1),
    pressureBar: +lerp(d.pressureBar[i], d.pressureBar[j], f).toFixed(2),
    flowM3Min: +lerp(d.flowM3Min[i], d.flowM3Min[j], f).toFixed(1),
    powerKw: Math.round(lerp(d.powerKw[i], d.powerKw[j], f)),
    currentA: +lerp(d.currentA[i], d.currentA[j], f).toFixed(1),
    vibration: +lerp(d.vibration[i], d.vibration[j], f).toFixed(2),
    windingTempC: +lerp(d.windingTempC[i], d.windingTempC[j], f).toFixed(1),
    bearingTempC: +lerp(d.bearingTempC[i], d.bearingTempC[j], f).toFixed(1),
    oilPressureBar: +lerp(d.oilPressureBar[i], d.oilPressureBar[j], f).toFixed(2),
    running: d.running[i] >= 0.5,
  }))
  return { station, devices }
}

const LIVE_INDEX = new Map(REAL.live.times.map((t, i) => [t, i]))

/**
 * 从末尾 24 小时的分钟级真实序列采样（实时监控使用，保留真实分钟波动）。
 */
export function sampleLive(timeStr: string): { station: StationSample; devices: DeviceSample[] } {
  const key = dayjs(timeStr).format('YYYY-MM-DD HH:mm:00')
  let i = LIVE_INDEX.get(key)
  if (i === undefined) {
    const near = nearestLiveIndex(key)
    i = near
  }
  const st = REAL.live.station
  const station: StationSample = {
    time: REAL.live.times[i],
    headerPressureBar: st.headerPressureBar[i],
    totalFlow: st.totalFlow[i],
    totalPowerKw: st.totalPowerKw[i],
    avgLoadRate: st.avgLoadRate[i],
  }
  const devices = Object.entries(REAL.live.devices).map(([id, d]) => ({
    id,
    loadRate: d.loadRate[i],
    pressureBar: d.pressureBar[i],
    flowM3Min: d.flowM3Min[i],
    powerKw: d.powerKw[i],
    currentA: d.currentA[i],
    vibration: d.vibration[i],
    windingTempC: d.windingTempC[i],
    bearingTempC: d.bearingTempC[i],
    oilPressureBar: d.oilPressureBar[i],
    running: d.running[i] >= 0.5,
  }))
  return { station, devices }
}

/** 实时序列内的近似下标（钳制到窗口范围） */
function nearestLiveIndex(key: string): number {
  const times = REAL.live.times
  if (key <= times[0]) return 0
  if (key >= times[times.length - 1]) return times.length - 1
  let lo = 0
  let hi = times.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] === key) return mid
    if (times[mid] < key) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, hi)
}

/** 以 endTime 结尾、从分钟级实时序列取窗口（用于实时趋势图，保留真实分钟波动） */
export function windowLive(endTime: string, hours: number, stepMin: number): StationSample[] {
  const endKey = dayjs(endTime).format('YYYY-MM-DD HH:mm:00')
  const endIdx = nearestLiveIndex(endKey)
  const endTime0 = dayjs(REAL.live.times[endIdx])
  const st = REAL.live.station
  const out: StationSample[] = []
  for (let k = hours * 60; k >= 0; k -= stepMin) {
    const i = endIdx - k
    if (i >= 0) {
      out.push({
        time: REAL.live.times[i],
        headerPressureBar: st.headerPressureBar[i],
        totalFlow: st.totalFlow[i],
        totalPowerKw: st.totalPowerKw[i],
        avgLoadRate: st.avgLoadRate[i],
      })
    } else {
      // 早于实时分钟窗口的部分，用小时序列插值补齐
      out.push(sampleInterpolated(endTime0.subtract(k, 'minute').format('YYYY-MM-DD HH:mm:ss')).station)
    }
  }
  return out
}

/** 以 endTime 结尾、按 stepMin 分钟插值采样的窗口（用于平滑滚动的趋势图） */
export function windowInterpolated(endTime: string, hours: number, stepMin: number): StationSample[] {
  const end = dayjs(endTime)
  const out: StationSample[] = []
  for (let m = hours * 60; m >= 0; m -= stepMin) {
    out.push(sampleInterpolated(end.subtract(m, 'minute').format('YYYY-MM-DD HH:mm:ss')).station)
  }
  return out
}

/** 实时驱动循环窗口：数据末端往前 24 小时 */
export const LIVE_WINDOW_HOURS = 24

/** 实时循环窗口起点（分钟级实时序列的首帧） */
export function liveWindowStart(): string {
  return REAL.live.times[0]
}

/** 将某时刻归入实时循环窗口（超出末端则回绕到窗口起点） */
export function normalizeLiveTime(timeStr: string): string {
  const end = dayjs(STATION.rangeEnd)
  const start = end.subtract(LIVE_WINDOW_HOURS, 'hour')
  const t = dayjs(timeStr)
  if (t.isAfter(end)) return start.format('YYYY-MM-DD HH:mm:00')
  if (t.isBefore(start)) return start.format('YYYY-MM-DD HH:mm:00')
  return t.format('YYYY-MM-DD HH:mm:00')
}
