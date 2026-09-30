import { AI_METRICS, BASELINE_METRICS } from '../data/timeseries'

export interface MetricDef {
  key: string
  name: string
  target: string
  targetNum: number
  current: number
  currentText: string
  baselineText: string
  unit: string
  betterWhenHigher: boolean
  bonus: boolean
  dataRange: string
  source: string
  reached: boolean
}

const baseline = BASELINE_METRICS
const ai = AI_METRICS

const energyImprove = +(((baseline.specificEnergy - ai.specificEnergy) / baseline.specificEnergy) * 100).toFixed(1)
const costReduce = +(energyImprove * 0.92).toFixed(1) // 年化口径略保守
const mtbfGain = +(energyImprove * 4.8).toFixed(0) // 预测性维护带来的 MTBF 提升（模拟回放口径）
const bigCarDown = +(((baseline.lowLoadHours - ai.lowLoadHours) / baseline.lowLoadHours) * 100).toFixed(0)
const pressureSwingDown = 36.2

export function metricDefs(): MetricDef[] {
  const defs: MetricDef[] = [
    {
      key: 'energy_improve', name: '系统综合能效提升率', target: '≥ 6%', targetNum: 6,
      current: energyImprove, currentText: `${energyImprove}%`, unit: '%', betterWhenHigher: true, bonus: false,
      baselineText: `基线比功率 ${baseline.specificEnergy} kWh/m³ → AI 期 ${ai.specificEnergy} kWh/m³`,
      dataRange: '近 30 天（前 15 天人工基线 / 后 15 天 AI 调度）',
      source: '能效与收益 · 系统比功率趋势；关联方案 PLAN-20260919-001',
      reached: energyImprove >= 6,
    },
    {
      key: 'load_deviation', name: '加载率偏离度', target: '≤ ±10%', targetNum: 10,
      current: ai.loadDeviationPct, currentText: `±${ai.loadDeviationPct}%`, unit: '%', betterWhenHigher: false, bonus: false,
      baselineText: `人工基线 ±${baseline.loadDeviationPct}%`,
      dataRange: '近 15 天 AI 调度期',
      source: '各机组实际加载率与方案目标值的平均绝对偏差',
      reached: ai.loadDeviationPct <= 10,
    },
    {
      key: 'pressure_qualify', name: '供气压力合格率', target: '≥ 99.5%', targetNum: 99.5,
      current: ai.pressureQualifyPct, currentText: `${ai.pressureQualifyPct}%`, unit: '%', betterWhenHigher: true, bonus: false,
      baselineText: `人工基线 ${baseline.pressureQualifyPct}%（合格带 0.78~0.84 bar）`,
      dataRange: '近 15 天 AI 调度期，SCADA 1min 粒度',
      source: '运行管理 · 母管压力趋势',
      reached: ai.pressureQualifyPct >= 99.5,
    },
    {
      key: 'surge_accuracy', name: '喘振预警准确率', target: '≥ 90%', targetNum: 90,
      current: 92.0, currentText: '92.0%', unit: '%', betterWhenHigher: true, bonus: false,
      baselineText: '基于喘振边界模型近 90 天回放：46 次预警 / 42 次有效（4 次误报）',
      dataRange: '近 90 天模拟回放',
      source: '设备健康 · 喘振风险模型（surge-guard-v3.1）',
      reached: true,
    },
    {
      key: 'unplanned_down', name: '非计划停机次数下降率', target: '≥ 50%', targetNum: 50,
      current: 60.0, currentText: '60.0%', unit: '%', betterWhenHigher: true, bonus: false,
      baselineText: '基线期月均 5 次 → AI 期 2 次（AC-02 轴承提前干预计入）',
      dataRange: '近 60 天模拟对比',
      source: '预测性维护工单闭环：WO-20260920-002',
      reached: true,
    },
    {
      key: 'plan_gen_time', name: '调度方案生成时间', target: '≤ 60 秒', targetNum: 60,
      current: 42, currentText: '42 秒（模拟）', unit: '秒', betterWhenHigher: false, bonus: false,
      baselineText: '人工编制方案约 40 分钟',
      dataRange: '近 10 次方案生成统计',
      source: '智能调度 · 方案生成用时',
      reached: true,
    },
    {
      key: 'nlu_accuracy', name: '自然语言指令理解准确率', target: '≥ 90%', targetNum: 90,
      current: 93.4, currentText: '93.4%（模拟评测）', unit: '%', betterWhenHigher: true, bonus: false,
      baselineText: '186 条现场常用问句模拟评测集',
      dataRange: '评测集 V2（模拟回放）',
      source: 'Agent 助手 · 意图识别评测',
      reached: true,
    },
    // 加分指标
    {
      key: 'cost_reduce', name: '单站年用电成本降低率', target: '5%~10%', targetNum: 5,
      current: costReduce, currentText: `${costReduce}%`, unit: '%', betterWhenHigher: true, bonus: true,
      baselineText: `年用电成本约 1577 万元，预计年节约约 ${Math.round(1577 * costReduce / 100)} 万元（电价 0.8 元/kWh）`,
      dataRange: '近 15 天 AI 期年化推演（模拟）',
      source: '能效与收益 · 月度报告',
      reached: costReduce >= 5 && costReduce <= 10,
    },
    {
      key: 'mtbf', name: 'MTBF 提升率', target: '≥ 30%', targetNum: 30,
      current: mtbfGain, currentText: `${mtbfGain}%（模拟回放）`, unit: '%', betterWhenHigher: true, bonus: true,
      baselineText: '基线 MTBF 1240h → AI 期推演 MTBF（含预测性维护干预）',
      dataRange: '近 60 天模拟回放',
      source: '设备健康 · 预测性维护闭环',
      reached: mtbfGain >= 30,
    },
    {
      key: 'big_car', name: '"大马拉小车"工况时长下降率', target: '≥ 60%', targetNum: 60,
      current: bigCarDown, currentText: `${bigCarDown}%`, unit: '%', betterWhenHigher: true, bonus: true,
      baselineText: `基线日均 ${baseline.lowLoadHours}h → AI 期 ${ai.lowLoadHours}h（加载率 <50% 且功率 >30% 额定）`,
      dataRange: '近 30 天对比',
      source: '能效与收益 · 低负载运行时长',
      reached: bigCarDown >= 60,
    },
    {
      key: 'pressure_swing', name: '压力波动幅度下降率', target: '≥ 30%', targetNum: 30,
      current: pressureSwingDown, currentText: `${pressureSwingDown}%`, unit: '%', betterWhenHigher: true, bonus: true,
      baselineText: `基线波动 ±0.037 bar → AI 期 ±0.016 bar（1σ）`,
      dataRange: '近 30 天母管压力统计',
      source: '运行管理 · 母管压力趋势',
      reached: pressureSwingDown >= 30,
    },
    {
      key: 'advance_warning', name: '异常预警提前时间', target: '≥ 24 小时', targetNum: 24,
      current: 36, currentText: '36 小时（AC-02 轴承案例）', unit: '小时', betterWhenHigher: true, bonus: true,
      baselineText: '基线为事后维修（提前 0h）',
      dataRange: '诊断报告 DG-20260921-002',
      source: '设备健康 · 诊断与证据链',
      reached: true,
    },
    {
      key: 'strategy_iter', name: '调度策略自适应迭代周期', target: '≤ 7 天', targetNum: 7,
      current: 5, currentText: '5 天（V1.2.0 → V1.3.0 候选）', unit: '天', betterWhenHigher: false, bonus: true,
      baselineText: '人工策略修订周期约 90 天',
      dataRange: '策略学习引擎记录',
      source: '数据与策略 · 版本管理',
      reached: true,
    },
    {
      key: 'surge_advance', name: '喘振预警提前时间', target: '≥ 30 秒', targetNum: 30,
      current: 45, currentText: '45 秒（模型推演）', unit: '秒', betterWhenHigher: true, bonus: true,
      baselineText: '人工难以判断，依赖联锁停机（事后）',
      dataRange: '诊断报告 DG-20260921-003',
      source: '设备健康 · 喘振风险区域',
      reached: true,
    },
    {
      key: 'xai_score', name: '关键决策可解释性评分', target: '≥ 80 分', targetNum: 80,
      current: 86, currentText: '86 分（专家评审模拟）', unit: '分', betterWhenHigher: true, bonus: true,
      baselineText: '评审维度：依据完整性、数据可追溯、风险披露、动作合理性',
      dataRange: '近 20 个已执行方案评审',
      source: '智能调度 · 方案解释与依据',
      reached: true,
    },
  ]
  return defs
}
