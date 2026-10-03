import type { Device, PlanAction, PlanStrategy, SchedulePlan } from '../types'
import { LOAD_FORECAST } from '../data/timeseries'
import { STATION, LOAD } from '../data/stationConfig'

/** 按加载率插值比功率 kW/(m³/min) */
export function specificPowerAt(d: Device, loadRate: number): number {
  if (!d.curve.length) return 0
  const c = [...d.curve].sort((a, b) => a.loadRate - b.loadRate)
  if (loadRate <= c[0].loadRate) return c[0].specificPower
  if (loadRate >= c[c.length - 1].loadRate) return c[c.length - 1].specificPower
  for (let i = 1; i < c.length; i++) {
    if (loadRate <= c[i].loadRate) {
      const t = (loadRate - c[i - 1].loadRate) / (c[i].loadRate - c[i - 1].loadRate)
      return +(c[i - 1].specificPower * (1 - t) + c[i].specificPower * t).toFixed(3)
    }
  }
  return c[c.length - 1].specificPower
}

export const flowAt = (d: Device, loadRate: number) => +((d.ratedFlowM3Min * loadRate) / 100).toFixed(1)
export const powerAt = (d: Device, loadRate: number) => Math.round(flowAt(d, loadRate) * specificPowerAt(d, loadRate))

/** 机组最优加载率区间 */
export function optimalBand(d: Device): [number, number] {
  return d.kind === 'centrifugal' ? [75, 85] : [60, 75]
}

export function peakDemand(): number {
  return Math.max(...LOAD_FORECAST.map(p => p.forecastM3Min))
}

interface Candidate {
  id: string
  name: string
  strategy: PlanStrategy
  actions: PlanAction[]
  on: Map<string, number>
  explanation: string[]
  risks: SchedulePlan['risks']
  pressureQualify: number
}

function buildActions(on: Map<string, number>, devices: Device[]): PlanAction[] {
  const actions: PlanAction[] = []
  for (const d of devices) {
    const isCompressor = d.kind === 'centrifugal' || d.kind === 'screw'
    if (!isCompressor) continue
    const target = on.get(d.id)
    const cur = d.loadRate
    if (target === undefined || target === 0) {
      if (d.status === 'running') actions.push({ deviceId: d.id, action: 'stop', reason: `${d.id} 当前加载率 ${cur}%，处于低效或高风险工况，停机消除损耗` })
    } else if (d.status === 'running') {
      if (Math.abs(target - cur) >= 3) actions.push({ deviceId: d.id, action: 'adjust_load', targetLoadRate: target, reason: `加载率 ${cur}%→${target}%：进入比功率最优区，预计功率 ${powerAt(d, target)} kW` })
    } else if (d.status === 'standby') {
      actions.push({ deviceId: d.id, action: 'start', targetLoadRate: target, reason: `启动并加载至 ${target}%（产气 ${flowAt(d, target)} m³/min，比功率 ${specificPowerAt(d, target)}），承接负荷缺口` })
    }
  }
  return actions
}

function totalEnergy(on: Map<string, number>, devices: Device[], hours: number): number {
  let kw = 0
  for (const [id, lr] of on) {
    const d = devices.find(x => x.id === id)!
    kw += powerAt(d, lr)
  }
  return Math.round(kw * hours)
}

/** 人工基线推演：维持现有机组组合，用高效机组拉高补缺口，低载机组继续运行 */
function baselineEnergy(devices: Device[], need: number, hours: number): number {
  const on = new Map<string, number>()
  for (const d of devices) {
    if ((d.kind === 'centrifugal' || d.kind === 'screw') && d.status === 'running') on.set(d.id, d.loadRate)
  }
  // 人工习惯：把在运的大机组往上拉
  let supplied = [...on.entries()].reduce((s, [id, lr]) => s + flowAt(devices.find(x => x.id === id)!, lr), 0)
  const big = [...on.entries()].sort((a, b) => b[1] - a[1])
  for (const [id] of big) {
    if (supplied >= need) break
    const d = devices.find(x => x.id === id)!
    on.set(id, 88)
    supplied += flowAt(d, 88) - flowAt(d, on.get(id) ?? d.loadRate)
  }
  return totalEnergy(on, devices, hours)
}

/** 多目标调度推理：生成三套候选方案（模拟 AI 引擎，可解释输出） */
export function generateCandidates(devices: Device[], hours: number, currentStrategy: { surgeMarginPct: number; minLoadRatePct: number; maxLoadRatePct: number }): Candidate[] {
  const need = peakDemand()
  const clampLoad = (v: number) => Math.min(currentStrategy.maxLoadRatePct, Math.max(currentStrategy.minLoadRatePct, Math.round(v)))
  const compressors = devices.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')
  const avail = compressors.filter(d => d.status === 'running' || d.status === 'standby')
  const running = avail.filter(d => d.status === 'running')
  const standby = avail.filter(d => d.status === 'standby')

  const candidates: Candidate[] = []
  const mk = function mk(
    id: string, name: string, strategy: PlanStrategy, on: Map<string, number>,
    explanation: string[], risks: SchedulePlan['risks'], pressureQualify: number,
  ): Candidate {
    return { id, name, strategy, on, actions: [], explanation, risks, pressureQualify }
  }

  // ---- 方案 B：稳供前提下节能（balanced，推荐）----
  {
    const on = new Map<string, number>()
    // 停掉低载运行机组
    for (const d of running) if (d.loadRate < 50) on.set(d.id, 0)
    // 按最优比功率贪心启用
    const pool = [...running.filter(d => (on.get(d.id) ?? d.loadRate) > 0), ...standby]
      .map(d => ({ d, sp: specificPowerAt(d, optimalBand(d)[0]) }))
      .sort((a, b) => a.sp - b.sp)
    let supplied = 0
    for (const { d } of pool) {
      if (supplied >= need) break
      const [lo, hi] = optimalBand(d)
      const target = clampLoad(Math.min(hi, Math.max(lo, lo)))
      on.set(d.id, target)
      supplied += flowAt(d, target)
    }
    // 最后一台调节补足（受策略加载率约束）
    const adjustables = pool.filter(p => (on.get(p.d.id) ?? 0) > 0)
    if (supplied < need && adjustables.length) {
      const last = adjustables[adjustables.length - 1]
      const rest = adjustables.slice(0, -1).reduce((s, p) => s + flowAt(p.d, on.get(p.d.id)!), 0)
      const target = clampLoad(((need - rest) / last.d.ratedFlowM3Min) * 100)
      on.set(last.d.id, target)
      supplied = rest + flowAt(last.d, target)
    }
    const e = totalEnergy(on, devices, hours)
    const base = baselineEnergy(devices, need, hours)
    const saving = +(((base - e) / base) * 100).toFixed(1)
    const explanation = [
      `负荷预测：未来 ${hours} 小时峰值需求约 ${need} m³/min（置信区间 ±5%），依据近 30 天同时段负荷特征与排产计划`,
      `机组校核：${avail.filter(d => (on.get(d.id) ?? 0) > 0).map(d => `${d.id}（${on.get(d.id)}%，产气 ${flowAt(d, on.get(d.id)!)}）`).join(' + ')}，在线产能 ${Math.round(supplied)} m³/min，可覆盖峰值需求`,
      `能耗推演：方案预计 ${e} kWh vs 人工基线推演 ${base} kWh，同口径预计节能 ${saving}%`,
      `效率逻辑：优先让比功率最低的机组承担基础负荷，消除加载率 <50% 的"大马拉小车"工况`,
    ]
    candidates.push(mk('balanced', `稳供前提下节能（推荐）`, 'balanced', on, explanation, {
      surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'low',
      pressureRiskText: `新启机组爬坡期间母管压力预计短暂回落，合格带 ${STATION.pressureBandBar[0]}~${STATION.pressureBandBar[1]} bar，建议提前 10 分钟启机`,
    }, 99.6))
  }

  // ---- 方案 A：稳供优先（stability）----
  {
    const on = new Map<string, number>()
    const maint = devices.find(d => d.status === 'maintenance')
    const pool = [...running.filter(d => d.loadRate >= 50), ...standby]
    let supplied = 0
    for (const d of pool) {
      const [lo] = optimalBand(d)
      const target = clampLoad(lo)
      on.set(d.id, target)
      supplied += flowAt(d, target)
    }
    if (maint?.status === 'maintenance') { on.set(maint.id, 55); supplied += flowAt(maint, 55) }
    const e = totalEnergy(on, devices, hours)
    const base = baselineEnergy(devices, need, hours)
    const saving = +(((base - e) / base) * 100).toFixed(1)
    candidates.push(mk('stability', '稳供优先', 'stability', on, [
      `以供气冗余为第一目标：在线产能 ${Math.round(supplied)} m³/min，高出峰值需求 ${need} 约 ${Math.round(((supplied / need) - 1) * 100)}%`,
      `任一机组异常均不影响供气，压力合格率预期 99.9%`,
      `代价：能耗高于基线约 ${Math.abs(saving)}%，该时段收益为负，仅建议在高风险场景选用`,
    ], {
      surgeRisk: 'low', overloadRisk: 'low', healthRisk: maint?.status === 'maintenance' ? 'medium' : 'low',
      pressureRiskText: '机组冗余最大，压力合格率预期最高',
    }, 99.9))
  }

  // ---- 方案 C：设备保护优先（protection）----
  {
    const on = new Map<string, number>()
    for (const d of running) if (d.loadRate < 50 || d.healthScore < 75) on.set(d.id, 0)
    const maint = devices.find(d => d.status === 'maintenance')
    const pool = [...running.filter(d => (on.get(d.id) ?? d.loadRate) > 0), ...standby]
      .map(d => ({ d, sp: specificPowerAt(d, optimalBand(d)[0]) }))
      .sort((a, b) => a.sp - b.sp)
    let supplied = 0
    for (const { d } of pool) {
      if (supplied >= need) break
      const [lo] = optimalBand(d)
      const target = clampLoad(lo)
      on.set(d.id, target)
      supplied += flowAt(d, target)
    }
    if (supplied < need && maint?.status === 'maintenance') { on.set(maint.id, 70); supplied += flowAt(maint, 70) }
    const e = totalEnergy(on, devices, hours)
    const base = baselineEnergy(devices, need, hours)
    const saving = +(((base - e) / base) * 100).toFixed(1)
    const stopped = avail.filter(d => (on.get(d.id) ?? 0) === 0 && d.status === 'running')
    candidates.push(mk('protection', '设备保护优先', 'protection', on, [
      `以设备保护为第一目标：${stopped.map(d => `${d.id}`).join('、') || '无'} 停机休整，消除轴承/振动恶化风险`,
      `两台机组按压力带约束运行，避免低载与温升/振动超限`,
      `在线产能 ${Math.round(supplied)} m³/min${supplied < need ? `，低于峰值需求 ${need}，需储气罐调节与错峰配合` : ''}`,
      `能耗推演：${e} kWh vs 基线 ${base} kWh（${saving >= 0 ? '节能' : '能耗增加'} ${Math.abs(saving)}%）`,
    ], {
      surgeRisk: 'none', overloadRisk: supplied < need ? 'medium' : 'low', healthRisk: 'low',
      pressureRiskText: supplied < need
        ? `在线产能低于峰值需求 ${Math.round(((1 - supplied / need) * 100))}%，压力合格率预期 ${99.9 - Math.round((1 - supplied / need) * 210)}%，低于 99.5% 目标，需产线错峰配合`
        : '在线产能满足峰值需求',
    }, supplied < need ? 98.9 : 99.6))
  }

  for (const c of candidates) c.actions = buildActions(c.on, devices)
  return candidates
}
