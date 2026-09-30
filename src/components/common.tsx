import { Tag, Tooltip, Alert, Typography } from 'antd'
import { ExperimentOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { AlertLevel, DeviceStatus, PlanStatus, RiskLevel, WorkOrderStatus, StrategyStatus, PlanStrategy } from '../types'

export const DemoTag = ({ text = '模拟数据 · 演示环境' }: { text?: string }) => (
  <Tooltip title="当前环境所有运行数据、控制回执与收益均为本地模拟，用于演示完整业务闭环">
    <Tag icon={<ExperimentOutlined />} color="gold" style={{ marginLeft: 8 }}>{text}</Tag>
  </Tooltip>
)

export const DemoAlertInline = ({ children }: { children?: React.ReactNode }) => (
  <Alert
    type="warning" showIcon banner
    icon={<ThunderboltOutlined />}
    message={<span style={{ fontSize: 12.5 }}>演示环境：本页运行数据、控制指令与回执均为<b>本地模拟</b>，模拟 REST API 响应，与真实 PLC/SCADA 无关</span>}
    description={children}
    style={{ marginBottom: 12 }}
  />
)

const deviceStatusMap: Record<DeviceStatus, { c: string; t: string }> = {
  running: { c: 'green', t: '运行中' },
  standby: { c: 'default', t: '待机' },
  maintenance: { c: 'gold', t: '检修中' },
  fault: { c: 'red', t: '故障' },
}
export const DeviceStatusTag = ({ s }: { s: DeviceStatus }) => <Tag color={deviceStatusMap[s].c}>{deviceStatusMap[s].t}</Tag>

const riskMap: Record<RiskLevel, { c: string; t: string }> = {
  none: { c: 'default', t: '无风险' },
  low: { c: 'green', t: '低风险' },
  medium: { c: 'gold', t: '中风险' },
  high: { c: 'red', t: '高风险' },
}
export const RiskTag = ({ r, text }: { r: RiskLevel; text?: string }) => <Tag color={riskMap[r].c}>{text ?? riskMap[r].t}</Tag>

const levelMap: Record<AlertLevel, { c: string; t: string }> = {
  info: { c: 'blue', t: '提示' },
  warning: { c: 'gold', t: '预警' },
  critical: { c: 'red', t: '紧急' },
}
export const AlertLevelTag = ({ l }: { l: AlertLevel }) => <Tag color={levelMap[l].c}>{levelMap[l].t}</Tag>

const alertStatusMap: Record<string, { c: string; t: string }> = {
  unconfirmed: { c: 'red', t: '未确认' },
  confirmed: { c: 'gold', t: '已确认' },
  dispatched_scheduling: { c: 'blue', t: '转调度处置' },
  to_workorder: { c: 'purple', t: '已转工单' },
  closed: { c: 'default', t: '已关闭' },
}
export const AlertStatusTag = ({ s }: { s: string }) => <Tag color={alertStatusMap[s]?.c ?? 'default'}>{alertStatusMap[s]?.t ?? s}</Tag>

const planStatusMap: Record<PlanStatus, { c: string; t: string }> = {
  draft: { c: 'default', t: '草稿' },
  pending_approval: { c: 'gold', t: '待审批' },
  approved: { c: 'cyan', t: '已批准' },
  rejected: { c: 'red', t: '已驳回' },
  dispatching: { c: 'processing', t: '下发中' },
  executed: { c: 'green', t: '已执行' },
  execute_failed: { c: 'red', t: '执行失败' },
  unknown: { c: 'orange', t: '状态未知' },
  reviewed: { c: 'green', t: '已执行 · 复盘完成' },
}
export const PlanStatusTag = ({ s }: { s: PlanStatus }) => <Tag color={planStatusMap[s].c} bordered={planStatusMap[s].c !== 'default'}>{planStatusMap[s].t}</Tag>

const strategyMap: Record<PlanStrategy, string> = {
  stability: '稳供优先',
  balanced: '稳供前提下节能',
  energy: '节能优先',
  protection: '设备保护优先',
}
export const StrategyTag = ({ s }: { s: PlanStrategy }) => <Tag color={s === 'balanced' ? 'geekblue' : s === 'stability' ? 'blue' : s === 'energy' ? 'green' : 'purple'}>{strategyMap[s]}</Tag>
export const strategyName = (s: PlanStrategy) => strategyMap[s]

const woStatusMap: Record<WorkOrderStatus, { c: string; t: string }> = {
  created: { c: 'gold', t: '已创建' },
  assigned: { c: 'blue', t: '已指派' },
  processing: { c: 'processing', t: '处理中' },
  retest_pending: { c: 'purple', t: '待复测验收' },
  closed: { c: 'green', t: '已验收关闭' },
}
export const WoStatusTag = ({ s }: { s: WorkOrderStatus }) => <Tag color={woStatusMap[s].c}>{woStatusMap[s].t}</Tag>

const stgStatusMap: Record<StrategyStatus, { c: string; t: string }> = {
  draft: { c: 'default', t: '草稿' },
  replay_passed: { c: 'cyan', t: '历史回放验证通过' },
  pending_release: { c: 'gold', t: '待发布' },
  active: { c: 'green', t: '生效中' },
  rolled_back: { c: 'red', t: '已回滚' },
  archived: { c: 'default', t: '已归档' },
}
export const StrategyStatusTag = ({ s }: { s: StrategyStatus }) => <Tag color={stgStatusMap[s].c}>{stgStatusMap[s].t}</Tag>

export const healthColor = (v: number) => (v >= 85 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f')

export const HealthBadge = ({ score }: { score: number }) => (
  <Tooltip title={`健康评分 ${score}/100（≥85 良好 / 70~84 关注 / <70 异常）`}>
    <Tag color={score >= 85 ? 'green' : score >= 70 ? 'gold' : 'red'} style={{ fontWeight: 600 }}>{score}</Tag>
  </Tooltip>
)

export const SectionTitle = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
    <div className="section-title" style={{ margin: 0 }}>{children}</div>
    {extra}
  </div>
)

export const ExplainBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div style={{ background: '#f7f9fc', border: '1px solid #e5ebf5', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>
    <Typography.Text strong style={{ fontSize: 13 }}>{title}</Typography.Text>
    <ul className="evidence-list" style={{ marginTop: 6 }}>
      {items.map((e, i) => <li key={i} style={{ fontSize: 12.5 }}>{e}</li>)}
    </ul>
  </div>
)
