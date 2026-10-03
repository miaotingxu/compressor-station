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

export function sampleAt(timeStr: string): { station: StationSample; devices: DeviceSample[] } {
  const i = nearestIndex(timeStr)
  const st = REAL.series.station
  const devices = Object.entries(REAL.series.devices).map(([id, d]) => ({
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
  return {
    station: {
      time: TIMES[i],
      headerPressureBar: st.headerPressureBar[i],
      totalFlow: st.totalFlow[i],
      totalPowerKw: st.totalPowerKw[i],
      avgLoadRate: st.avgLoadRate[i],
    },
    devices,
  }
}

/** 返回以 endTime 结尾的最近 hours 小时窗口（用于趋势图） */
export function windowEndingAt(endTime: string, hours: number): StationSample[] {
  const end = nearestIndex(endTime)
  const start = Math.max(0, end - hours + 1)
  const st = REAL.series.station
  const out: StationSample[] = []
  for (let i = start; i <= end; i++) {
    out.push({
      time: TIMES[i],
      headerPressureBar: st.headerPressureBar[i],
      totalFlow: st.totalFlow[i],
      totalPowerKw: st.totalPowerKw[i],
      avgLoadRate: st.avgLoadRate[i],
    })
  }
  return out
}

/** 时间轴是否处于数据末端（近 24 小时视为"最新"） */
export function isAtLatest(timeStr: string): boolean {
  return dayjs(timeStr).isAfter(dayjs(STATION.rangeEnd).subtract(24, 'hour'))
}
