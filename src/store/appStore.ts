import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
import type {
  Alert, AuditLog, ChatMessage, DataQualityIssue, DataSource, Device, Diagnosis, Member,
  PlanAction, RoleKey, SchedulePlan, StrategyVersion, TodoItem, WorkOrder, ExecutionReceipt,
} from '../types'
import {
  ALERTS, AUDIT_LOGS, DATA_QUALITY_ISSUES, DATA_SOURCES, DEVICES, DIAGNOSES, MEMBERS, PLANS,
  ROLE_DEFS, STRATEGIES, TODOS, WORK_ORDERS, DEMO_NOW, fmt,
} from '../data/initial'
import { generateCandidates, flowAt, powerAt, specificPowerAt, optimalBand, peakDemand } from '../utils/scheduler'
import { STATION } from '../data/stationConfig'
import { sampleInterpolated, sampleLive, clampToRange, normalizeLiveTime, liveWindowStart, type DeviceSample } from '../data/stationTime'

export const now = () => fmt(dayjs())

let seq = 1000
const uid = (p: string) => `${p}-${++seq}-${Date.now().toString(36).slice(-4)}`

/** 演示身份默认为值班员 */
export const DEFAULT_ROLE: RoleKey = 'operator'

interface AppState {
  currentRole: RoleKey
  devices: Device[]
  alerts: Alert[]
  plans: SchedulePlan[]
  workOrders: WorkOrder[]
  strategies: StrategyVersion[]
  todos: TodoItem[]
  auditLogs: AuditLog[]
  dataIssues: DataQualityIssue[]
  dataSources: DataSource[]
  chat: ChatMessage[]
  /** 模拟"数据源异常/数据质量不合格"开关：开启后禁止生成可下发方案 */
  simulateDataOutage: boolean
  /** 模拟"高风险喘振"安全拦截开关：开启后阻断调度下发 */
  simulateSurgeBlock: boolean
  generating: boolean
  /** 站点数据时间轴：当前定位到的数据时刻 */
  dataTime: string
  /** 实时驱动是否开启（按分钟推进并平滑插值） */
  live: boolean

  switchRole: (r: RoleKey) => void
  me: () => Member
  roleOf: () => string

  refreshRealtime: () => void
  /** 将时间轴定位到指定时刻，并同步设备遥测（会暂停实时驱动） */
  setDataTime: (t: string) => void
  /** 开启 / 暂停实时驱动 */
  toggleLive: () => void
  /** 实时推进一步（1 分钟，平滑插值），到达末端回绕 */
  tickLive: () => void
  toggleDataOutage: (v: boolean) => void
  toggleSurgeBlock: (v: boolean) => void

  addAudit: (action: string, target: string, detail: string, result?: 'success' | 'denied') => void
  resolveTodo: (id: string, note?: string) => void

  confirmAlert: (id: string) => void
  alertToScheduling: (id: string) => void
  alertToWorkorder: (id: string, workOrderId: string) => void
  closeAlert: (id: string, conclusion: string) => void

  createWorkOrder: (input: { deviceId: string; title: string; description: string; priority: WorkOrder['priority']; source: WorkOrder['source']; relatedDiagnosisId?: string; relatedAlertId?: string }) => string
  assignWorkOrder: (id: string, assignee: string) => void
  startWorkOrder: (id: string) => void
  submitRetest: (id: string, metrics: WorkOrder['retestMetrics'], repairRecord: string) => void
  acceptWorkOrder: (id: string, acceptance: string) => boolean

  generatePlans: (hours: number) => Promise<SchedulePlan[]>
  updatePlanActions: (planId: string, actions: PlanAction[]) => void
  approvePlan: (planId: string) => void
  rejectPlan: (planId: string, reason: string) => void
  dispatchPlan: (planId: string) => Promise<void>
  resolveAbnormalPlan: (planId: string, action: 'redispatch' | 'manual_close', note: string) => Promise<void>

  releaseStrategy: (id: string) => void
  rollbackStrategy: (id: string) => void
  rejectStrategy: (id: string, note: string) => void

  pushChat: (m: ChatMessage) => void
  clearChat: () => void
}

const initialDevices = () => DEVICES.map(d => ({ ...d, curve: d.curve.map(c => ({ ...c })) }))

/** 用真实时序采样值同步设备遥测（替代原先的随机抖动） */
function applySamples(devices: Device[], samples: DeviceSample[]): Device[] {
  const map = new Map(samples.map(s => [s.id, s]))
  return devices.map(d => {
    const s = map.get(d.id)
    if (!s) return d
    return {
      ...d,
      status: s.running ? 'running' : 'standby',
      loadRate: Math.round(s.loadRate),
      pressureBar: +s.pressureBar.toFixed(2),
      flowM3Min: +s.flowM3Min.toFixed(1),
      powerKw: Math.round(s.powerKw),
      currentA: +s.currentA.toFixed(1),
      vibration: s.vibration,
      windingTempC: s.windingTempC,
      bearingTempC: s.bearingTempC,
      oilPressureBar: s.oilPressureBar,
    }
  })
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      currentRole: DEFAULT_ROLE,
      devices: applySamples(initialDevices(), sampleLive(liveWindowStart()).devices),
      alerts: ALERTS.map(a => ({ ...a })),
      plans: PLANS.map(p => ({ ...p, actions: p.actions.map(a => ({ ...a })) })),
      workOrders: WORK_ORDERS.map(w => ({ ...w, spareParts: w.spareParts.map(s => ({ ...s })), retestMetrics: w.retestMetrics.map(r => ({ ...r })) })),
      strategies: STRATEGIES.map(s => ({ ...s })),
      todos: TODOS.map(t => ({ ...t })),
      auditLogs: AUDIT_LOGS.map(a => ({ ...a })),
      dataIssues: DATA_QUALITY_ISSUES.map(d => ({ ...d })),
      dataSources: DATA_SOURCES.map(d => ({ ...d })),
      chat: [],
      simulateDataOutage: false,
      simulateSurgeBlock: false,
      generating: false,
      dataTime: liveWindowStart(),
      live: true,

      switchRole: (r) => {
        const member = MEMBERS.find(m => m.role === r)!
        set({ currentRole: r })
        get().addAudit('角色切换', member.name, `以「${ROLE_DEFS.find(x => x.key === r)!.name}」身份查看系统`)
      },
      me: () => MEMBERS.find(m => m.role === get().currentRole)!,
      roleOf: () => ROLE_DEFS.find(r => r.key === get().currentRole)!.name,

      refreshRealtime: () => {
        const { dataTime } = get()
        const { devices } = sampleInterpolated(dataTime)
        set(s => ({ devices: applySamples(s.devices, devices) }))
      },

      setDataTime: (t) => {
        const tt = clampToRange(t)
        const { devices } = sampleInterpolated(tt)
        set(s => ({ dataTime: tt, live: false, devices: applySamples(s.devices, devices) }))
      },

      toggleLive: () => set(s => ({ live: !s.live })),

      tickLive: () => {
        const s = get()
        const next = dayjs(s.dataTime).add(1, 'minute').format('YYYY-MM-DD HH:mm:ss')
        const tt = normalizeLiveTime(next)
        const { devices } = sampleLive(tt)
        set(st => ({ dataTime: tt, devices: applySamples(st.devices, devices) }))
      },

      toggleDataOutage: (v) => {
        set({ simulateDataOutage: v })
        get().addAudit('模拟数据异常开关', '数据与策略', v ? '开启：模拟 SCADA 点表字段缺失，禁止生成可下发方案' : '关闭：数据质量恢复正常')
      },
      toggleSurgeBlock: (v) => {
        set({ simulateSurgeBlock: v })
        get().addAudit('模拟喘振高风险开关', '智能调度', v ? '开启：模拟高风险喘振场景，阻断调度下发并进入应急处置' : '关闭：喘振风险恢复正常')
      },

      addAudit: (action, target, detail, result = 'success') => {
        const me = get().me()
        set(s => ({
          auditLogs: [
            { id: uid('LOG'), time: now(), actor: me.name, role: s.currentRole, action, target, detail, result },
            ...s.auditLogs,
          ].slice(0, 400),
        }))
      },

      resolveTodo: (id, note) => {
        const me = get().me()
        set(s => ({
          todos: s.todos.map(t => (t.id === id || t.refId === id) ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name, resolveNote: note } : t),
        }))
      },

      confirmAlert: (id) => {
        const me = get().me()
        set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'confirmed', confirmedBy: me.name, confirmedAt: now() } : a) }))
        get().addAudit('告警确认', id, '确认告警并进入处置流程')
        set(s => ({ todos: s.todos.map(t => t.refId === id ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name } : t) }))
      },

      alertToScheduling: (id) => {
        set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'dispatched_scheduling' } : a) }))
        get().addAudit('告警转调度处置', id, '已纳入调度优化建议')
      },

      alertToWorkorder: (id, workOrderId) => {
        set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'to_workorder', relatedWorkOrderId: workOrderId } : a) }))
        get().addAudit('告警转维修工单', id, `生成工单 ${workOrderId}`)
      },

      closeAlert: (id, conclusion) => {
        set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'closed', conclusion, closedAt: now() } : a) }))
        get().addAudit('告警关闭', id, `处理结论：${conclusion}`)
        set(s => ({ todos: s.todos.map(t => t.refId === id ? { ...t, done: true, resolvedAt: now(), resolvedBy: get().me().name } : t) }))
      },

      createWorkOrder: (input) => {
        const id = `WO-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 900) + 100)}`
        const wo: WorkOrder = {
          id, deviceId: input.deviceId, title: input.title, description: input.description,
          priority: input.priority, status: 'created', spareParts: [], retestMetrics: [],
          createdAt: now(), source: input.source, relatedDiagnosisId: input.relatedDiagnosisId, relatedAlertId: input.relatedAlertId,
        }
        set(s => ({ workOrders: [wo, ...s.workOrders] }))
        get().addAudit('创建维修工单', id, `${input.deviceId}：${input.title}`)
        return id
      },

      assignWorkOrder: (id, assignee) => {
        set(s => ({ workOrders: s.workOrders.map(w => w.id === id ? { ...w, status: 'assigned', assignee } : w) }))
        get().addAudit('工单指派', id, `指派给 ${assignee}`)
        set(s => ({ todos: s.todos.map(t => t.refId === id ? { ...t, done: true, resolvedAt: now() } : t) }))
      },

      startWorkOrder: (id) => {
        set(s => ({ workOrders: s.workOrders.map(w => w.id === id ? { ...w, status: 'processing' } : w) }))
        get().addAudit('工单开工', id, '维修处理中')
      },

      submitRetest: (id, metrics, repairRecord) => {
        set(s => ({ workOrders: s.workOrders.map(w => w.id === id ? { ...w, status: 'retest_pending', retestMetrics: metrics, repairRecord } : w) }))
        get().addAudit('提交复测数据', id, `复测指标 ${metrics.length} 项，等待验收`)
      },

      acceptWorkOrder: (id, acceptance) => {
        const wo = get().workOrders.find(w => w.id === id)
        if (!wo) return false
        if (wo.status !== 'retest_pending' || !wo.retestMetrics.length) return false
        const me = get().me()
        set(s => ({
          workOrders: s.workOrders.map(w => w.id === id ? { ...w, status: 'closed', acceptance, closedAt: now() } : w),
          todos: s.todos.map(t => t.refId === id ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name } : t),
        }))
        get().addAudit('工单验收关闭', id, acceptance)
        return true
      },

      // ============ 智能调度 ============
      generatePlans: async (hours) => {
        const s = get()
        const strategy = s.strategies.find(x => x.status === 'active')!
        const candidates = generateCandidates(s.devices, hours, {
          surgeMarginPct: strategy.params.surgeMarginPct,
          minLoadRatePct: strategy.params.minLoadRatePct,
          maxLoadRatePct: strategy.params.maxLoadRatePct,
        })
        const batchId = `B-${dayjs().format('YYYYMMDD-HHmm')}`
        const plans: SchedulePlan[] = candidates.map(c => {
          const on: [string, number][] = [...c.on.entries()]
          const e = on.reduce((sum, [id, lr]) => sum + powerAt(s.devices.find(d => d.id === id)!, lr), 0) * hours
          return {
            id: `PLAN-${dayjs().format('YYYYMMDD')}-${c.id.toUpperCase().slice(0, 3)}-${String(Math.floor(Math.random() * 90) + 10)}`,
            name: `${dayjs().format('MM-DD HH:mm')} 起候选方案（${c.name}）`,
            strategy: c.strategy,
            status: 'pending_approval',
            createdAt: now(),
            effectiveFrom: dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DD HH:00'),
            durationHours: hours,
            actions: c.actions,
            expectedEnergyKwh: Math.round(e),
            baselineEnergyKwh: Math.round(e * 1.022),
            expectedSavingsPct: +((1 - e / (e * 1.022)) * 100).toFixed(1),
            expectedPressureQualifyPct: c.pressureQualify,
            risks: c.risks,
            explanation: [
              ...c.explanation,
              `策略版本：${strategy.version}（生效中），约束：加载率 ${strategy.params.minLoadRatePct}%~${strategy.params.maxLoadRatePct}%、压力带 ${strategy.params.pressureBandBar[0]}~${strategy.params.pressureBandBar[1]} bar、喘振裕度 ≥${strategy.params.surgeMarginPct}%`,
              `数据时段：${dayjs().subtract(30, 'day').format('YYYY-MM-DD HH:mm')} ~ ${now()}（30 天时序 + 负荷预测 + 设备性能曲线 + 实时健康状态）`,
            ],
            evidencePeriod: `${dayjs().subtract(30, 'day').format('YYYY-MM-DD')} ~ ${dayjs().format('YYYY-MM-DD')}`,
            createdBy: 'Agent 调度引擎',
            batchId,
          }
        })
        set(st => ({ plans: [...plans, ...st.plans] }))
        get().addAudit('生成调度方案', batchId, `生成 ${plans.length} 套候选方案（${hours}h 窗口），等待人工审批`)
        return plans
      },

      updatePlanActions: (planId, actions) => {
        set(s => ({ plans: s.plans.map(p => p.id === planId ? { ...p, actions } : p) }))
      },

      approvePlan: (planId) => {
        const s = get()
        const plan = s.plans.find(p => p.id === planId)
        if (!plan) return
        if (s.currentRole !== 'operator') {
          s.addAudit('方案审批（越权尝试）', planId, `${s.roleOf()} 无方案审批权限，系统拒绝`, 'denied')
          return
        }
        const me = s.me()
        set(st => ({
          plans: st.plans.map(p => p.id === planId ? { ...p, status: 'approved', approvedBy: me.name, approvedAt: now() } : p),
        }))
        s.addAudit('方案批准', planId, `${me.name} 批准方案（策略：${plan.strategy}），可进入下发流程`)
        set(st => ({ todos: st.todos.map(t => t.kind === 'plan_approval' && t.detail.includes(plan.batchId ?? '') ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name } : t) }))
      },

      rejectPlan: (planId, reason) => {
        const s = get()
        if (s.currentRole !== 'operator') {
          s.addAudit('方案驳回（越权尝试）', planId, `${s.roleOf()} 无方案审批权限，系统拒绝`, 'denied')
          return
        }
        const me = s.me()
        set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: 'rejected', rejectedBy: me.name, rejectedAt: now(), rejectReason: reason } : p) }))
        s.addAudit('方案驳回', planId, `驳回原因：${reason}（已进入策略学习记录）`)
      },

      dispatchPlan: async (planId) => {
        const s = get()
        const plan = s.plans.find(p => p.id === planId)
        if (!plan) return
        if (s.currentRole !== 'operator') {
          s.addAudit('调度下发（越权尝试）', planId, `${s.roleOf()} 无控制指令下发权限，系统拒绝`, 'denied')
          return
        }
        if (s.simulateSurgeBlock || plan.surgeBlocked) {
          set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, surgeBlocked: true } : p) }))
          s.addAudit('调度下发被安全拦截', planId, '检测到高风险设备告警（5# 二级振动），调度下发已阻断，进入应急处置流程', 'denied')
          return
        }
        const me = s.me()
        set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: 'dispatching' } : p) }))
        s.addAudit('调度下发', planId, `${me.name} 下发控制指令（演示环境模拟控制），涉及 ${plan.actions.length} 台设备`)

        // 模拟逐设备下发与回执（带延迟）
        const receipts: ExecutionReceipt[] = []
        for (const act of plan.actions) {
          const d = s.devices.find(x => x.id === act.deviceId)!
          const cmdText = act.action === 'stop' ? '停机' : act.action === 'start' ? `启动并加载至 ${act.targetLoadRate}%` : act.action === 'adjust_load' ? `加载率调整至 ${act.targetLoadRate}%` : `压力设定 ${act.targetPressureBar} bar`
          await new Promise(r => setTimeout(r, 700 + Math.random() * 900))
          let result: 'success' | 'failed' | 'timeout' = 'success'
          let message = '执行成功，回执确认'
          // 网关可靠性由设备档案（数据完整性）决定，不再写死机组编号
          if (d.gatewayReliable === false && Math.random() < 0.3) {
            result = 'timeout'
            message = '控制网关未在 10s 内返回回执，执行状态未知，需人工核实'
          }
          receipts.push({
            deviceId: act.deviceId, command: cmdText, result, message,
            latencyMs: result === 'timeout' ? 10000 : Math.round(600 + Math.random() * 3200),
            finishedAt: now(),
          })
          set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, receipts: [...receipts] } : p) }))
        }
        const hasAbnormal = receipts.some(r => r.result !== 'success')
        const finalStatus = hasAbnormal ? 'unknown' : 'executed'
        set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: finalStatus } : p) }))
        if (hasAbnormal) {
          const bad = receipts.filter(r => r.result !== 'success').map(r => `${r.deviceId}（${r.result === 'timeout' ? '超时' : '失败'}）`).join('、')
          const todo: TodoItem = {
            id: uid('TD'), kind: 'execution_abnormal', severity: 'high',
            title: `方案 ${planId} 执行异常（${bad}）`,
            detail: '存在失败/超时回执，整体方案不能标记为"已执行"，请人工核实现场状态后选择重新下发或人工处置',
            createdAt: now(), link: '/execution', done: false, refId: planId,
          }
          set(st => ({ todos: [todo, ...st.todos] }))
          get().addAudit('执行回执异常', planId, `${bad} 回执异常，方案标记为"状态未知"，已创建异常待办`)
        } else {
          const todo: TodoItem = {
            id: uid('TD'), kind: 'energy_deviation', severity: 'low',
            title: `方案 ${planId} 已执行，待效果复盘`,
            detail: '执行完成，请进入执行中心确认复盘数据并查看收益分析',
            createdAt: now(), link: '/execution', done: false,
          }
          set(st => ({ todos: [todo, ...st.todos] }))
        }
      },

      resolveAbnormalPlan: async (planId, action, note) => {
        const s = get()
        if (s.currentRole !== 'operator') {
          s.addAudit('异常处置（越权尝试）', planId, `${s.roleOf()} 无控制处置权限，系统拒绝`, 'denied')
          return
        }
        const me = s.me()
        if (action === 'redispatch') {
          set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: 'dispatching', receipts: [] } : p) }))
          s.addAudit('重新下发', planId, `${me.name} 对异常方案重新下发：${note}`)
          await new Promise(r => setTimeout(r, 1200))
          const plan = get().plans.find(p => p.id === planId)!
          const receipts = plan.actions.map(a => ({
            deviceId: a.deviceId,
            command: a.action === 'stop' ? '停机' : a.action === 'start' ? `启动并加载至 ${a.targetLoadRate}%` : `加载率调整至 ${a.targetLoadRate}%`,
            result: 'success' as const, message: '重新下发成功，回执确认', latencyMs: Math.round(800 + Math.random() * 2000), finishedAt: now(),
          }))
          set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: 'executed', receipts } : p) }))
          get().addAudit('重新下发完成', planId, '全部回执成功，方案标记为已执行')
        } else {
          set(st => ({ plans: st.plans.map(p => p.id === planId ? { ...p, status: 'execute_failed' } : p) }))
          get().addAudit('人工处置关闭', planId, `${me.name} 人工处置：${note}，方案标记为"执行失败"归档`)
        }
        set(st => ({ todos: st.todos.map(t => t.kind === 'execution_abnormal' && t.title.includes(planId) ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name, resolveNote: note } : t) }))
      },

      // ============ 策略 ============
      releaseStrategy: (id) => {
        const s = get()
        if (s.currentRole !== 'admin') {
          s.addAudit('策略发布（越权尝试）', id, `${s.roleOf()} 无策略发布权限，系统拒绝`, 'denied')
          return
        }
        const me = s.me()
        const stg = s.strategies.find(x => x.id === id)!
        set(st => ({
          strategies: st.strategies.map(x => x.id === id ? { ...x, status: 'active', releasedAt: now() } : x.status === 'active' ? { ...x, status: 'archived' } : x),
        }))
        get().addAudit('策略发布', stg.version, `${me.name} 将 ${stg.version} 发布为生效版本，原生效版本归档`)
        set(st => ({ todos: st.todos.map(t => t.kind === 'strategy_release' ? { ...t, done: true, resolvedAt: now(), resolvedBy: me.name } : t) }))
      },

      rollbackStrategy: (id) => {
        const s = get()
        if (s.currentRole !== 'admin') {
          s.addAudit('策略回滚（越权尝试）', id, `${s.roleOf()} 无策略回滚权限，系统拒绝`, 'denied')
          return
        }
        const me = s.me()
        const target = s.strategies.find(x => x.id === id)!
        set(st => ({
          strategies: st.strategies.map(x => x.id === id ? { ...x, status: 'active', rolledBackAt: undefined, releasedAt: now() } : x.status === 'active' ? { ...x, status: 'rolled_back', rolledBackAt: now() } : x),
        }))
        get().addAudit('策略回滚', target.version, `${me.name} 回滚至 ${target.version}，原生效版本已标记回滚`)
      },

      rejectStrategy: (id, note) => {
        const s = get()
        if (s.currentRole !== 'admin') {
          s.addAudit('策略驳回（越权尝试）', id, `${s.roleOf()} 无策略发布权限，系统拒绝`, 'denied')
          return
        }
        set(st => ({ strategies: st.strategies.map(x => x.id === id ? { ...x, status: 'draft' } : x) }))
        get().addAudit('策略版本驳回', id, `驳回原因：${note}，退回草稿`)
        set(st => ({ todos: st.todos.map(t => t.kind === 'strategy_release' ? { ...t, done: true, resolvedAt: now() } : t) }))
      },

      pushChat: (m) => set(s => ({ chat: [...s.chat, m] })),
      clearChat: () => set({ chat: [] }),
    }),
    {
      // v3：实时驱动后不再持久化 devices（避免每秒写入 localStorage），并丢弃旧缓存
      name: 'airpress-agent-store-v3',
      partialize: (s) => ({
        currentRole: s.currentRole, alerts: s.alerts, plans: s.plans,
        workOrders: s.workOrders, strategies: s.strategies, todos: s.todos, auditLogs: s.auditLogs,
        chat: s.chat, simulateDataOutage: s.simulateDataOutage, simulateSurgeBlock: s.simulateSurgeBlock,
      }),
    },
  ),
)

/** 判断当前数据质量是否允许生成可下发方案 */
export function useDataQualityBlock(): { blocked: boolean; reasons: string[] } {
  const { simulateDataOutage, dataIssues } = useApp()
  const blocking = dataIssues.filter(i => i.blockPlan && !i.resolved)
  if (simulateDataOutage) {
    return {
      blocked: true,
      reasons: [
        'SCADA 实时库（DS-SCADA-01）通讯中断：母管压力、总流量点位数据陈旧 >15 分钟',
        '4#/5# 控制网关字段缺失：B 相电流全程为 0、加卸载/预警字段缺失',
        '按安全规则：数据质量不合格时禁止生成可下发调度方案',
      ],
    }
  }
  if (blocking.length) {
    return { blocked: true, reasons: blocking.map(i => i.detail) }
  }
  // 未阻断时，返回严重未解决项作为关注提示（不阻断）
  const attention = dataIssues.filter(i => i.severity === 'critical' && !i.resolved)
  return { blocked: false, reasons: attention.map(i => `[关注] ${i.detail}`) }
}

export const AGENT_META = { DEMO_NOW }
