import dayjs from 'dayjs'
import type { AgentStructuredAnswer, ChatMessage, RoleKey } from '../types'
import { useApp } from '../store/appStore'
import { AI_METRICS, BASELINE_METRICS, LOAD_FORECAST, ENERGY_DAILY } from '../data/timeseries'
import { REAL } from '../data/realDataset'
import { DIAGNOSES } from '../data/initial'
import { peakDemand } from './scheduler'

const baseline = BASELINE_METRICS

export const SUGGESTED_QUESTIONS = [
  '未来两小时的最优开机组合是什么？',
  '为什么 5# 二级振动偏高？',
  '当前有哪些设备风险？',
  '近期能效为什么变化？',
  '帮我生成调度方案。',
  '当前有哪些待办需要我处理？',
]

const nowStr = () => dayjs().format('YYYY-MM-DD HH:mm')

function mkStructured(partial: Partial<AgentStructuredAnswer> & { conclusion: string }): AgentStructuredAnswer {
  return {
    evidence: [], dataPeriod: '真实数据 2026-03-12 ~ 2026-09-12', devices: [], risks: [], nextActions: [],
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
      conclusion: `已为您起草未来 4 小时的调度方案（${nowStr()} 起生效）。基于真实数据末端负荷预测（峰值约 ${need} m³/min）与设备健康约束，我生成了 4# / 5# 的负载分配建议，并创建为"待审批方案"。按安全规则，我不会直接下发任何控制指令，需值班员在智能调度页审批后方可执行。`,
      evidence: [
        `负荷预测：未来 4 小时用气峰值约 ${need} m³/min（基于真实末端一日分时形态，置信区间 ±5%）`,
        '机组档案：4#、5# 均为阿特拉斯 ZH1250-6，额定 1250 kW / 268.9 m³/min，额定排气压力 6.6 bar',
        '健康约束：4# 排气/绕组温升偏高，5# 二级振动均值约 9.1 mm/s，两者均限制长期高位运行',
        `策略约束：加载率 65%~92%、压力带 5.0~6.4 bar、喘振裕度 ≥10%`,
      ],
      devices: ['AC-04', 'AC-05'],
      risks: ['4# 温升偏高，长时间高位运行会加剧冷却系统负荷', '5# 二级振动偏高，不宜长期高加载率'],
      nextActions: ['进入「智能调度」页查看三套候选方案并比较', '值班员审批推荐方案后到「执行中心」下发'],
      createPlan: {
        strategy: 'balanced',
        actions: [
          { deviceId: 'AC-04', action: 'adjust_load', targetLoadRate: 78, reason: '回调至比功率较优区，降低排气与绕组温度' },
          { deviceId: 'AC-05', action: 'adjust_load', targetLoadRate: 92, reason: '承担主力出力，覆盖负荷，同时监控二级振动' },
        ],
        effectiveFrom: dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DD HH:00'),
      },
    })
    suggested.push('查看方案的预期节能与风险对比', '为什么 5# 二级振动偏高？')
  }
  // ---- 为什么 5# 振动高 ----
  else if (has('为什么') && has('5#', 'AC-05', '振动')) {
    structured = mkStructured({
      conclusion: '5# 的二级转子振动全周期均值约 9.08 mm/s、峰值 25.15 mm/s，高于 ISO 10816 C 区下限 7.1 mm/s；一级/三级振动仅约 3.5 / 3.9 mm/s，差异指向二级转子，常见原因为轴承磨损、转子动平衡劣化或对中偏差。',
      evidence: [
        '二级振动：均值 9.08 mm/s、峰值 25.15 mm/s（全周期真实数据）',
        '一级/三级振动：均值约 3.53 / 3.88 mm/s，显著低于二级',
        '电机轴承温度均值 41.4℃，尚处正常区间',
        '5# 全周期运行率约 97%，累计负载时间约 4309 h',
      ],
      dataPeriod: '真实数据 2026-03-12 ~ 2026-09-12',
      devices: ['AC-05'],
      risks: ['高风险：二级转子轴承持续劣化可能演变为非计划停机'],
      nextActions: ['72h 内安排二级转子频谱复测（工单 WO-20260912-001）', '在「设备健康」页查看诊断证据链'],
    })
    suggested.push('帮我生成调度方案', '当前有哪些设备风险？')
  }
  // ---- 设备风险 / 振动风险 ----
  else if (has('风险', '振动')) {
    const dg = DIAGNOSES.find(d => d.id === 'DG-20260912-001')!
    structured = mkStructured({
      conclusion: '当前主要有两类设备风险：① 5# 二级振动偏高（均值约 9.1 mm/s），存在轴承磨损风险；② 4# 排气/绕组温升偏高（峰值 115℃ / 90℃），冷却系统换热效率需核查。另有 B 相电流全程为 0 的数据质量问题。',
      evidence: [
        '5# 二级振动均值 9.08 mm/s，超 C 区下限 7.1 mm/s',
        '4# 排气温度峰值 115℃、绕组峰值 90℃、冷却水均值 30.8℃',
        '4#/5# B 相电流全周期恒为 0，三相监测不完整',
        '4# 停机时长占比约 17.6%，两台机组负载分配不均',
      ],
      dataPeriod: '真实数据全周期',
      devices: ['AC-05', 'AC-04'],
      risks: [dg.conclusion, '数据质量：B 相电流缺失影响电气健康评估'],
      nextActions: ['在「设备健康」页查看两项诊断与证据链', '处理工单 WO-20260912-001（5# 振动）与 WO-20260911-002（4# 冷却）'],
    })
    suggested.push('为什么 5# 二级振动偏高？', '未来两小时的最优开机组合是什么？')
  }
  // ---- 能效变化 ----
  else if (has('能效') && (has('下降', '变化', '为什么') || has('近期', '本周'))) {
    const recent = ENERGY_DAILY.slice(-7)
    const prev = ENERGY_DAILY.slice(-14, -7)
    const avg = (arr: typeof recent) => +(arr.reduce((s, r) => s + r.specificEnergy, 0) / arr.length).toFixed(4)
    structured = mkStructured({
      conclusion: `近 7 天系统比功率均值 ${avg(recent)} kWh/m³，前一周 ${avg(prev)} kWh/m³，环比变化 ${(((avg(recent) - avg(prev)) / avg(prev)) * 100).toFixed(1)}%。真实数据前后半程对比：基线期 ${baseline.specificEnergy} kWh/m³、近期 ${AI_METRICS.specificEnergy} kWh/m³，近期能耗略高，主要受季节温升与冷却负荷上升影响。`,
      evidence: [
        `近 7 天逐日比功率：${recent.map(r => `${r.date.slice(5)} ${r.specificEnergy}`).join('，')}`,
        `基线期（前半程）系统比功率 ${baseline.specificEnergy}，近期（后半程）${AI_METRICS.specificEnergy}`,
        `压力合格率：基线期 ${baseline.pressureQualifyPct}% → 近期 ${AI_METRICS.pressureQualifyPct}%`,
      ],
      dataPeriod: '真实数据全周期（前后半程对比）',
      devices: ['AC-04', 'AC-05'],
      risks: ['真实数据未包含 AI 调度干预，无法据此证明节能收益，需另行标注口径'],
      nextActions: ['在「能效与收益」页查看逐日明细与计算依据', '管理员可在「数据与策略」页审批 V1.2.0 候选策略'],
    })
    suggested.push('当前有哪些待办需要我处理？', '当前有哪些设备风险？')
  }
  // ---- 最优开机组合 ----
  else if (has('开机组合', '组合', '最优') || (has('未来') && has('小时'))) {
    const need = peakDemand()
    structured = mkStructured({
      conclusion: `未来两小时负荷将从 ${LOAD_FORECAST[0].forecastM3Min} 升至约 ${need} m³/min。建议组合：4# 回落至约 78%（降低温升）+ 5# 维持约 92%（承担主力，同时监控二级振动）。两台机组覆盖需求，较基线同产气口径预计能耗下降约 2%。`,
      evidence: [
        '4# 额定 268.9 m³/min / 1250 kW，当前加载率约 91%、排气压力约 6.2 bar',
        '5# 额定 268.9 m³/min / 1250 kW，当前加载率约 93%',
        '4# 温升偏高 → 主动回调；5# 振动偏高 → 不宜超 92% 长期运行',
        `负荷预测峰值 ${need} m³/min，两台合计额定产能 537.8 m³/min，产能充足`,
      ],
      dataPeriod: '真实末端负荷形态 + 设备档案',
      devices: ['AC-04', 'AC-05'],
      risks: ['4# 回调幅度过大可能导致母管压力下滑，需保持 5.0 bar 以上', '5# 振动偏高，高位运行需加密监测'],
      nextActions: ['进入「智能调度」页一键生成并比较三套候选方案', '值班员审批后下发'],
    })
    suggested.push('帮我生成调度方案', '为什么 5# 二级振动偏高？')
  }
  // ---- 待办 ----
  else if (has('待办', '需要处理', '要做什么')) {
    const open = store.todos.filter(t => !t.done)
    structured = mkStructured({
      conclusion: `当前有 ${open.length} 项待办：高危 ${open.filter(t => t.severity === 'high').length} 项、中危 ${open.filter(t => t.severity === 'medium').length} 项、低 ${open.filter(t => t.severity === 'low').length} 项。最优先：① 3 套调度方案待审批；② 5# 二级振动、4# 温升告警待确认；③ 方案 PLAN-20260911-002 执行状态未知待处置。`,
      evidence: open.slice(0, 6).map(t => `[${t.severity === 'high' ? '高' : t.severity === 'medium' ? '中' : '低'}] ${t.title}（${t.detail.slice(0, 40)}…）`),
      dataPeriod: '实时待办清单',
      devices: ['AC-05', 'AC-04'],
      risks: ['高危告警未确认可能延误处置窗口'],
      nextActions: ['进入「工作台」逐项处理待办', '处理完成后待办自动转入历史记录'],
    })
    suggested.push('未来两小时的最优开机组合是什么？')
  }
  // ---- 为什么这样调度 ----
  else if (has('为什么这样调度', '为什么调度', '依据')) {
    const plan = store.plans.find(p => p.status === 'pending_approval' && p.strategy === 'balanced') ?? store.plans.find(p => p.status === 'reviewed')
    structured = mkStructured({
      conclusion: plan
        ? `以方案「${plan.name}」为例：该组合在满足峰值需求约 ${peakDemand()} m³/min 与压力带 5.0~6.4 bar 约束下，将负载在两台机组间再分配，降低 4# 温升与 5# 振动负荷，预计节能 ${plan.expectedSavingsPct}%，压力合格率预期 ${plan.expectedPressureQualifyPct}%。`
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
      conclusion: '我已理解您的问题。当前站点已接入主办方真实数据（2 台阿特拉斯 ZH1250-6 离心机，2026-03-12 ~ 2026-09-12）。我可以回答：最优开机组合与调度解释、设备健康与振动/温升风险、能效变化归因、待办清单，以及帮您起草待审批的调度方案。',
      evidence: ['真实数据包：设备档案、运行参数、状态监测、管网、环境、用气负荷、维护保养、运行事件、指标释义'],
      dataPeriod: '真实数据 2026-03-12 ~ 2026-09-12',
      devices: REAL.devices.map(d => d.id),
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
