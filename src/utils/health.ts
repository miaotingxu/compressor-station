// 真实的设备健康评分与风险判定算法。
// 输入为主办方真实测点的统计量（振动/绕组/轴承/排气温度、油压、BOV 闭度、IGV 开度），
// 输出健康分、喘振风险与可解释的判定依据，替代原先写死的常量。
import type { RiskLevel } from '../types'
import { HEALTH_THRESHOLDS as T, SURGE_THRESHOLDS as S } from '../data/stationConfig'

export interface HealthInput {
  vibration: number
  windingTempC: number
  bearingTempC: number
  exhaustTempC: number
  oilPressureBar: number
  bovPct: number
  igvPct: number
}

export interface HealthFinding {
  metric: string
  value: string
  level: 'info' | 'warning' | 'critical'
  detail: string
}

export interface HealthAssessment {
  score: number
  surgeRisk: RiskLevel
  findings: HealthFinding[]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function assessHealth(input: HealthInput): HealthAssessment {
  let score = 100
  const findings: HealthFinding[] = []

  // 振动：ISO 10816，C 区下限报警、D 区下限严重
  if (input.vibration >= T.vibrationAlarm) {
    score -= 18 + (input.vibration - T.vibrationAlarm) * 1.5
    findings.push({ metric: '振动速度', value: `${input.vibration} mm/s`, level: 'critical', detail: `超过 D 区下限 ${T.vibrationAlarm} mm/s，存在明显机械故障风险` })
  } else if (input.vibration >= T.vibrationWarn) {
    score -= (input.vibration - T.vibrationWarn) * 3
    findings.push({ metric: '振动速度', value: `${input.vibration} mm/s`, level: 'warning', detail: `超过 C 区下限 ${T.vibrationWarn} mm/s，建议频谱复测` })
  }

  // 电机绕组温度
  if (input.windingTempC >= T.windingAlarm) {
    score -= 15
    findings.push({ metric: '绕组温度', value: `${input.windingTempC} ℃`, level: 'critical', detail: `超过 ${T.windingAlarm} ℃ 绝缘报警线` })
  } else if (input.windingTempC >= T.windingWarn) {
    score -= (input.windingTempC - T.windingWarn) * 1.2
    findings.push({ metric: '绕组温度', value: `${input.windingTempC} ℃`, level: 'warning', detail: `超过 ${T.windingWarn} ℃ 关注线` })
  }

  // 轴承温度
  if (input.bearingTempC >= T.bearingAlarm) {
    score -= 12
    findings.push({ metric: '轴承温度', value: `${input.bearingTempC} ℃`, level: 'critical', detail: `超过 ${T.bearingAlarm} ℃，轴承可能劣化` })
  } else if (input.bearingTempC >= T.bearingWarn) {
    score -= (input.bearingTempC - T.bearingWarn)
    findings.push({ metric: '轴承温度', value: `${input.bearingTempC} ℃`, level: 'warning', detail: `超过 ${T.bearingWarn} ℃ 关注线` })
  }

  // 排气温度（反映冷却系统换热效率）
  if (input.exhaustTempC >= T.exhaustAlarm) {
    score -= 12
    findings.push({ metric: '排气温度', value: `${input.exhaustTempC} ℃`, level: 'critical', detail: `超过 ${T.exhaustAlarm} ℃，冷却系统需立即检查` })
  } else if (input.exhaustTempC >= T.exhaustWarn) {
    score -= (input.exhaustTempC - T.exhaustWarn) * 0.8
    findings.push({ metric: '排气温度', value: `${input.exhaustTempC} ℃`, level: 'warning', detail: `超过 ${T.exhaustWarn} ℃，冷却系统换热效率下降` })
  }

  // 变速箱油压
  if (input.oilPressureBar > 0 && input.oilPressureBar < T.oilPressureLow) {
    score -= 6
    findings.push({ metric: '变速箱油压', value: `${input.oilPressureBar} bar`, level: 'warning', detail: `低于 ${T.oilPressureLow} bar 润滑关注线` })
  }

  // 喘振风险：BOV 闭度越低，回流越多，越接近喘振边界
  let surgeRisk: RiskLevel = 'none'
  if (input.bovPct < S.high) surgeRisk = 'high'
  else if (input.bovPct < S.medium) surgeRisk = 'medium'
  else if (input.bovPct < S.low) surgeRisk = 'low'
  if (surgeRisk !== 'none') {
    findings.push({ metric: 'BOV 闭度', value: `${input.bovPct}%`, level: surgeRisk === 'high' ? 'critical' : 'warning', detail: '放空阀闭度偏低，回流损失增大，喘振裕度收窄' })
  }

  // IGV 满开提示（接近满负荷，调节余量有限）
  if (input.igvPct >= 99) {
    findings.push({ metric: 'IGV 开度', value: `${input.igvPct}%`, level: 'info', detail: '进气导叶接近满开，机组已接近满负荷运行' })
  }

  return { score: Math.round(clamp(score, 40, 99)), surgeRisk, findings }
}
