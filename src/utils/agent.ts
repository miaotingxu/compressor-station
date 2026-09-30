import dayjs from 'dayjs'
import type { AgentStructuredAnswer, ChatMessage, PlanAction, RoleKey } from '../types'
import { useApp } from '../store/appStore'
import { AI_METRICS, BASELINE_METRICS, LOAD_FORECAST, ENERGY_DAILY } from '../data/timeseries'
const baseline = BASELINE_METRICS
import { DIAGNOSES } from '../data/initial'
import { peakDemand } from './scheduler'

export const SUGGESTED_QUESTIONS = [
  '未来两小时的最优开机组合是什么？',
  '为什么建议停掉 AC-03？',
  '当前有哪些喘振风险？',
  '本周能效为什么下降？',
  '帮我生成明天早高峰的调度方案。',
  '当前有哪些待办需要我处理？',
]

const nowStr = () => dayjs().format('YYYY-MM-DD HH:mm')

function mkStructured(partial: Partial<AgentStructuredAnswer> & { conclusion: string }): AgentStructuredAnswer {
  return {
    evidence: [], dataPeriod: '近 30 天时序 + 实时数据', devices: [], risks: [], nextActions: [],
    ...partial,
  }
}

/** 识别控制意图，仅创建"待审批调度方案"，绝不直接执行 */
export function handleUserMessage(text: string, role: RoleKey): ChatMessage {
  const store = useApp.getState()
  const t = text.trim()
  const has = (...kw: string[]) => kw.some(k => t.includes(k))

  let structured: AgentStructuredAnswer
  const suggested: string[] = []

  // ---- 控制意图：生成方案 ----
  if (has('生成', '创建', '安排') && has('方案', '调度', '开机组合')) {
    const need = peakDemand()
    structured = mkStructured({
      conclusion: `已为您起草未来 4 小时的调度方案（${nowStr()} 起生效）。我基于负荷预测（峰值约 ${need} m³/min）与设备健康约束生成了推荐组合，并已创建为"待审批方案"。按安全规则，我不会直接下发任何控制指令，需值班员在智能调度页审批后方可执行。`,
      evidence: [
        `负荷预测：未来 4 小时用气量上升至峰值 ${need} m³/min（早高峰场景，置信区间 ±5%）`,
        '机组效率：AC-04 比功率 5.94 最优，AC-03 当前 32% 低载比功率 7.63 偏高 23%',
        '健康约束：AC-02 轴承温度 88℃，已限制其加载率上限',
        `策略版本：V1.2.0（生效中），加载率约束 55%~85%，喘振裕度 ≥10%`,
      ],
      devices: ['AC-01', 'AC-02', 'AC-03', 'AC-04'],
      risks: ['AC-04 启动爬坡 6 分钟内母管压力短暂回落 0.03 bar', 'AC-01 喘振裕度 8.6% 低于安全阈值，方案已按 85% 加载率留出 10.2% 裕度'],
      nextActions: ['进入「智能调度」页查看三套候选方案并比较', '值班员审批推荐方案后到「执行中心」下发'],
      createPlan: {
        strategy: 'balanced',
        actions: [
          { deviceId: 'AC-03', action: 'stop', reason: '低载高耗，停机消除"大马拉小车"工况' },
          { deviceId: 'AC-04', action: 'start', targetLoadRate: 68, reason: '全站效率最高机组，承接停机缺口' },
          { deviceId: 'AC-01', action: 'adjust_load', targetLoadRate: 85, reason: '进入比功率最优区，维持喘振裕度 10.2%' },
          { deviceId: 'AC-02', action: 'adjust_load', targetLoadRate: 70, reason: '降载保护轴承，等待明日检修' },
        ],
        effectiveFrom: dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DD HH:00'),
      },
    })
    suggested.push('查看方案的预期节能与风险对比', '为什么建议停掉 AC-03？')
  }
  // ---- 为什么停 AC-03 ----
  else if (has('为什么') && has('AC-03', '3#', '停')) {
    structured = mkStructured({
      conclusion: '建议停运 AC-03 的核心原因：它处于"大马拉小车"工况——加载率仅 32%，比功率 7.63 kW/(m³/min)，较本机最优值 6.19 偏高约 23%；停运后其 12.8 m³/min 出力由比功率最优（5.94）的 AC-04 承接，供气无缺口且更省电。',
      evidence: [
        '近 30 天 AC-03 加载率分布：24%~38% 占比 81%，仅 4% 时间在 55% 以上',
        '当前：出力 12.8 m³/min，功耗 101 kW；同等气量若由 AC-04（68%）产出仅需约 76 kW',
        'AC-03 日均启停 9.2 次，远高于经济运行参考 ≤2 次/日，加剧损耗',
        '替代能力校核：AC-04 为热备机组，健康分 93，启动至 68% 后系统总产能可覆盖峰值需求 385 m³/min',
      ],
      dataPeriod: `${dayjs().subtract(30, 'day').format('YYYY-MM-DD')} ~ 今天（30 天时序）`,
      devices: ['AC-03', 'AC-04'],
      risks: ['AC-04 启动爬坡期间母管压力短暂回落约 0.03 bar，建议提前 10 分钟启机'],
      nextActions: ['在「智能调度」页批准候选方案 B（推荐）', '执行后观察 AC-03 停机与 AC-04 爬坡过程'],
    })
    suggested.push('帮我生成调度方案', '本周能效为什么下降？')
  }
  // ---- 喘振风险 ----
  else if (has('喘振')) {
    const dg = DIAGNOSES.find(d => d.id === 'DG-20260921-003')!
    structured = mkStructured({
      conclusion: '当前有 1 项高优先级喘振风险：AC-01 运行点距喘振边界仅 8.6%（安全阈值 10%），主要因进口滤网压差 4.2 kPa 偏高导致吸入流量下降。若负荷继续上升或母管压力抬升，存在喘振损坏叶轮的风险；模型预警提前时间约 45 秒，可触发紧急联锁保护。',
      evidence: [
        '喘振边界模型：机前压力 0.82 bar、导叶开度 62% 时，喘振点流量 201 m³/min，当前流量 187 m³/min',
        '近 7 日裕度从 14.2% 收窄至 8.6%，与滤网压差上升相关',
        '防喘阀开度 12%，回流内循环造成功率损失约 3.1%',
        '已生成工单 WO-20260921-003：进口滤网清理与防喘阀校验',
      ],
      dataPeriod: '实时工况 + 近 7 日趋势',
      devices: ['AC-01'],
      risks: ['高风险：喘振可在数秒内损坏叶轮', '当前方案生成/下发已叠加喘振约束，AC-01 加载率调整后裕度恢复至 10.2% 以上'],
      nextActions: ['在「设备健康」页查看喘振风险详情与诊断证据', '设备工程师处理工单 WO-20260921-003（滤网清理）', '在「数据与策略」页可开启"模拟高风险喘振"体验安全拦截'],
    })
    suggested.push('为什么建议停掉 AC-03？', '未来两小时的最优开机组合是什么？')
  }
  // ---- 能效下降 ----
  else if (has('能效') && (has('下降', '为什么') || has('本周', '本周能效'))) {
    const recent = ENERGY_DAILY.slice(-7)
    const prev = ENERGY_DAILY.slice(-14, -7)
    const avg = (arr: typeof recent) => +(arr.reduce((s, r) => s + r.specificEnergy, 0) / arr.length).toFixed(4)
    structured = mkStructured({
      conclusion: `近 7 天系统比功率均值 ${avg(recent)} kWh/m³，前一周 ${avg(prev)} kWh/m³，环比变化 ${(((avg(recent) - avg(prev)) / avg(prev)) * 100).toFixed(1)}%。波动主要来自：09-16 三车间扩产试运行短时拉高负荷、09-18 夜间一次方案回执超时导致 AC-04 未按计划加载（空载 2.1h）、以及周末负荷特性差异。整体仍优于人工基线 ${baseline.specificEnergy} kWh/m³。`,
      evidence: [
        `近 7 天逐日比功率：${recent.map(r => `${r.date.slice(5)} ${r.specificEnergy}`).join('，')}`,
        '09-18 异常事件：PLAN-20260920-002 中 AC-04 回执超时，执行状态未知，空载运行 2.1 小时',
        '周末负荷整体下降 24%，机组组合未及时收缩（已纳入 V1.3.0 候选策略的轮换休整）',
      ],
      dataPeriod: `近 14 天（${ENERGY_DAILY.slice(-14)[0].date} ~ 今天）`,
      devices: ['AC-04', 'AC-03'],
      risks: ['若夜班未按方案停运 AC-03，低载损耗会再次抬升比功率'],
      nextActions: ['在「能效与收益」页查看逐日明细与计算依据', '管理员可在「数据与策略」页审批发布 V1.3.0 候选策略（含周末轮换）'],
    })
    suggested.push('当前有哪些待办需要我处理？', '当前有哪些喘振风险？')
  }
  // ---- 最优开机组合 ----
  else if (has('开机组合', '组合', '最优') || (has('未来') && has('小时'))) {
    const need = peakDemand()
    structured = mkStructured({
      conclusion: `未来两小时负荷将从 ${LOAD_FORECAST[0].forecastM3Min} 升至约 ${need} m³/min。最优组合：AC-01 提至 85%（比功率最优区）+ AC-02 保持 70%（兼顾轴承保护）+ AC-04 启动加载 68%（全站效率最高）+ AC-03 停机（消除低载损耗）。该组合恰好覆盖峰值需求，预计较人工操作节能约 2.1%。`,
      evidence: [
        'AC-01 85%：产气 204 m³/min，比功率 6.67，处于 75%~85% 最优带',
        'AC-02 70%：产气 140 m³/min，降载减小轴承受力（轴承温度 88℃ 偏高）',
        'AC-04 68%：产气 41 m³/min，比功率 5.94 全站最低',
        'AC-03 停机：其 12.8 m³/min 出力由 AC-04 富余能力承接',
      ],
      dataPeriod: '负荷预测（未来 2h）+ 实时设备状态 + 30 天效率曲线',
      devices: ['AC-01', 'AC-02', 'AC-03', 'AC-04'],
      risks: ['AC-01 喘振裕度收窄（8.6%），方案已按 ≥10% 裕度校核', 'AC-04 启动爬坡 6 分钟压力短时回落'],
      nextActions: ['进入「智能调度」页一键生成并比较三套候选方案', '值班员审批后下发'],
    })
    suggested.push('帮我生成明天早高峰的调度方案。', '为什么建议停掉 AC-03？')
  }
  // ---- 待办 ----
  else if (has('待办', '需要处理', '要做什么')) {
    const open = store.todos.filter(t => !t.done)
    structured = mkStructured({
      conclusion: `当前有 ${open.length} 项待办：高危 ${open.filter(t => t.severity === 'high').length} 项、中危 ${open.filter(t => t.severity === 'medium').length} 项、低 ${open.filter(t => t.severity === 'low').length} 项。最优先：① 3 套早高峰调度方案待审批；② AC-02 轴承温度告警与 AC-01 喘振裕度告警待确认；③ 方案 PLAN-20260920-002 执行状态未知待处置。`,
      evidence: open.slice(0, 6).map(t => `[${t.severity === 'high' ? '高' : t.severity === 'medium' ? '中' : '低'}] ${t.title}（${t.detail.slice(0, 40)}…）`),
      dataPeriod: '实时待办清单',
      devices: ['AC-02', 'AC-01', 'AC-04'],
      risks: ['高危告警未确认可能延误处置窗口'],
      nextActions: ['进入「工作台」逐项处理待办', '处理完成后待办自动转入历史记录'],
    })
    suggested.push('未来两小时的最优开机组合是什么？')
  }
  // ---- 为什么这样调度（解释当前方案）----
  else if (has('为什么这样调度', '为什么调度', '依据')) {
    const plan = store.plans.find(p => p.status === 'pending_approval' && p.strategy === 'balanced') ?? store.plans.find(p => p.status === 'reviewed')
    structured = mkStructured({
      conclusion: plan
        ? `以方案「${plan.name}」为例：该组合在满足峰值需求 ${peakDemand()} m³/min 与喘振裕度 ≥10% 约束下，优先消除低效点（AC-03 低载、AC-01 回流损失），由高效率机组承担基础负荷，预计节能 ${plan.expectedSavingsPct}%，压力合格率预期 ${plan.expectedPressureQualifyPct}%。`
        : '当前暂无候选方案，可在智能调度页一键生成。',
      evidence: plan ? [...plan.explanation, `依据数据时段：${plan.evidencePeriod}`] : [],
      dataPeriod: plan?.evidencePeriod ?? '—',
      devices: plan?.actions.map(a => a.deviceId) ?? [],
      risks: [plan?.risks.pressureRiskText ?? '—'],
      nextActions: ['在「智能调度」页查看方案解释与依据原文', '驳回方案时填写原因，将进入策略学习记录'],
    })
  }
  // ---- 兜底 ----
  else {
    structured = mkStructured({
      conclusion: '我已理解您的问题。当前演示环境我可以回答：最优开机组合与调度解释、设备健康与喘振风险、能效变化归因、待办清单，以及帮您起草待审批的调度方案。您可以换个问法，或直接选择下方推荐问题。',
      evidence: ['演示环境知识库：站点运行数据、设备档案、诊断报告、工单与方案库'],
      dataPeriod: '近 30 天 + 实时',
      devices: [],
      risks: [],
      nextActions: ['尝试点击下方推荐问题'],
    })
    suggested.push(...SUGGESTED_QUESTIONS.slice(0, 3))
  }

  void role
  return {
    id: `msg-${Date.now()}`,
    role: 'agent',
    content: structured.conclusion,
    time: nowStr(),
    structured,
    suggested,
  }
}
