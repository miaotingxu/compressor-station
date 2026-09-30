import { useMemo, useState } from 'react'
import {
  Card, Row, Col, Button, Tag, Space, Modal, Input, InputNumber, message, Steps, Alert, Table,
  Progress, Tooltip, Empty, Descriptions, Form, Select,
} from 'antd'
import {
  AimOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, SaveOutlined,
  SendOutlined, ExclamationCircleOutlined, InfoCircleOutlined, RobotOutlined, FileDoneOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp, useDataQualityBlock } from '../store/appStore'
import { DemoAlertInline, PlanStatusTag, StrategyTag, RiskTag, SectionTitle, ExplainBlock, strategyName, DemoTag } from '../components/common'
import { Chart, AXIS_TIME, AXIS_VAL } from '../components/Chart'
import { LOAD_FORECAST } from '../data/timeseries'
import { specificPowerAt } from '../utils/scheduler'
import type { PlanAction, PlanStrategy, SchedulePlan } from '../types'
import dayjs from 'dayjs'

const STRATEGY_INTRO: { key: PlanStrategy; name: string; desc: string }[] = [
  { key: 'stability', name: '稳供优先', desc: '以供气冗余与压力稳定为第一目标，可接受能耗上升' },
  { key: 'balanced', name: '稳供前提下节能（默认）', desc: '满足峰值供气与安全约束后，最大化节能收益' },
  { key: 'protection', name: '设备保护优先', desc: '优先考虑设备健康与喘振裕度，可接受压力合格率下降' },
]

export default function SchedulingPage() {
  const nav = useNavigate()
  const {
    plans, devices, generatePlans, approvePlan, rejectPlan, updatePlanActions, me, roleOf, currentRole,
    simulateSurgeBlock, toggleSurgeBlock,
  } = useApp()
  const dq = useDataQualityBlock()

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [genSeconds, setGenSeconds] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<SchedulePlan | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editTarget, setEditTarget] = useState<SchedulePlan | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const peak = Math.max(...LOAD_FORECAST.map(p => p.forecastM3Min))
  const candidates = plans.filter(p => p.status === 'pending_approval')
  const approved = plans.filter(p => p.status === 'approved')
  const recommended = candidates.find(p => p.strategy === 'balanced')

  const canApprove = currentRole === 'operator'

  const runGenerate = async () => {
    if (dq.blocked) { message.error('数据质量不合格，禁止生成可下发方案'); return }
    setGenerating(true)
    setProgress(0)
    const start = Date.now()
    const timer = setInterval(() => {
      setGenSeconds(+((Date.now() - start) / 1000).toFixed(1))
      setProgress(p => Math.min(96, p + 4 + Math.random() * 6))
    }, 400)
    // 模拟 AI 引擎推理（负荷预测 → 组合寻优 → 校核 → 可解释生成）
    await new Promise(r => setTimeout(r, 4200))
    await generatePlans(4)
    clearInterval(timer)
    setProgress(100)
    setGenSeconds(+((Date.now() - start) / 1000).toFixed(1))
    setTimeout(() => setGenerating(false), 600)
    message.success(`方案生成完成，用时 ${((Date.now() - start) / 1000).toFixed(1)} 秒（目标 ≤60 秒）`)
  }

  const statusStep = (p: SchedulePlan) => {
    const map: Record<string, number> = { draft: 0, pending_approval: 1, approved: 2, rejected: 1, dispatching: 3, executed: 4, unknown: 4, execute_failed: 4, reviewed: 4 }
    return map[p.status] ?? 0
  }

  return (
    <div className="page-container">
      <h1 className="page-title">智能调度<DemoTag text="AI 推荐为模拟推理 · 下发前必须人工审批" /></h1>
      <div className="page-subtitle">
        基于负荷预测、设备性能曲线与健康约束生成多套候选方案。AI 只做推荐，<b>所有控制指令必须经值班员人工审批后下发</b>。
      </div>

      <DemoAlertInline />

      {/* 数据质量门禁 */}
      <Alert
        style={{ marginBottom: 12 }}
        type={dq.blocked ? 'error' : 'success'}
        showIcon icon={dq.blocked ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
        message={dq.blocked ? '数据质量不合格 —— 已禁止生成可下发方案' : '数据质量检查通过，可以生成方案'}
        description={dq.blocked ? (
          <div style={{ fontSize: 12.5 }}>
            {dq.reasons.map((r, i) => <div key={i}>· {r}</div>)}
            <div style={{ marginTop: 4 }}>可在「数据与策略」页处理数据质量问题后重试。</div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5 }}>
            数据源在线率 5/6（DS-PLC-04 降级但未阻断）· 数据完整率 99.2% · 最新数据延迟 1.2 分钟 · 压力约束与喘振边界配置完整
          </div>
        )}
        action={
          <Space>
            <Button size="small" onClick={() => nav('/data-strategy')}>数据与策略</Button>
            <Button size="small" type={simulateSurgeBlock ? 'primary' : 'default'} danger={simulateSurgeBlock} onClick={() => toggleSurgeBlock(!simulateSurgeBlock)}>
              {simulateSurgeBlock ? '关闭喘振拦截模拟' : '模拟高风险喘振'}
            </Button>
          </Space>
        }
      />

      {simulateSurgeBlock && (
        <Alert
          style={{ marginBottom: 12 }} type="error" showIcon
          message="安全拦截生效中：AC-01 喘振裕度 8.6% 低于安全阈值 10%（高风险）"
          description="按核心安全规则，出现高风险喘振时阻断调度下发并进入应急处置。已批准方案的下发将被拒绝，请先在「设备健康」页处理喘振风险（工单 WO-20260921-003）。"
          action={<Button size="small" danger onClick={() => nav('/health')}>去处理喘振风险</Button>}
        />
      )}

      {/* 负荷预测与生成 */}
      <Row gutter={12}>
        <Col xs={24} lg={15}>
          <Card
            size="small" title={<Space><AimOutlined /> 未来 4 小时负荷预测</Space>}
            extra={<Tag color="blue">峰值 {peak} m³/min</Tag>}
          >
            <LoadForecastChart />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 6 }}>
              预测依据：近 30 天同时段负荷特征 + 三车间排产计划（MES）+ 天气/班次修正。置信区间 ±5%。当前在线产能与预测峰值的缺口，将由方案自动校核补足。
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card size="small" title={<Space><RobotOutlined /> 方案生成</Space>}>
            <Space direction="vertical" size={8} style={{ width: '%' }}>
              <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)' }}>
                引擎：Agent 调度引擎（策略 V1.2.0 生效中）· 约束：加载率 55%~85%、压力带 0.78~0.84 bar、喘振裕度 ≥10%
              </div>
              <div>
                {STRATEGY_INTRO.map(s => (
                  <div key={s.key} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 12.5 }}>
                    <Tag color={s.key === 'balanced' ? 'geekblue' : s.key === 'stability' ? 'blue' : 'purple'} style={{ flexShrink: 0 }}>{s.name}</Tag>
                    <span style={{ color: 'rgba(0,0,0,0.55)' }}>{s.desc}</span>
                  </div>
                ))}
              </div>
              {generating ? (
                <div>
                  <Progress percent={Math.round(progress)} status="active" />
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                    推理中：负荷预测 → 机组组合寻优 → 压力/喘振校核 → 可解释生成 …… 已用 {genSeconds}s（目标 ≤60s）
                  </div>
                </div>
              ) : (
                <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={runGenerate} disabled={dq.blocked} block>
                  一键生成调度方案（目标 ≤60 秒）
                </Button>
              )}
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>
                生成后将同时给出「稳供优先 / 稳供前提下节能 / 设备保护优先」三套候选方案与解释依据。
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 待审批方案 */}
      <SectionTitle extra={
        <Space>
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>审批人：{me().name}（{roleOf()}）{canApprove ? '' : ' —— 当前角色无审批权限，仅可查看'}</span>
          <Button size="small" onClick={() => setHistoryOpen(true)}>历史批次</Button>
        </Space>
      }>
        待审批候选方案 {candidates.length > 0 && <Tag color="gold">{candidates.length} 套（批次 {candidates[0]?.batchId}）</Tag>}
      </SectionTitle>

      {candidates.length === 0 ? (
        <Card><Empty description="暂无待审批方案。点击上方「一键生成调度方案」开始。" /></Card>
      ) : (
        <>
          {/* 对比表 */}
          <Card size="small" style={{ marginBottom: 12 }} title="方案对比（节能收益 · 压力风险 · 设备风险 · 执行影响）">
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={candidates}
              rowClassName={r => r.strategy === 'balanced' ? 'ant-table-row-selected' : ''}
              columns={[
                { title: '方案', dataIndex: 'name', render: (v, r) => <Space direction="vertical" size={0}><span>{v}</span><Space size={4}><StrategyTag s={r.strategy} />{r.strategy === 'balanced' && <Tag color="red">推荐</Tag>}</Space></Space> },
                { title: '机组动作', render: (_, r: SchedulePlan) => (
                  <div style={{ fontSize: 12 }}>{r.actions.map(a => <div key={a.deviceId + a.action}>{actionText(a)}</div>)}</div>
                ) },
                { title: '预计节能', dataIndex: 'expectedSavingsPct', width: 110, align: 'right' as const, render: (v: number) => (
                  <span style={{ fontWeight: 600, color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? `-${v}% 能耗` : `+${Math.abs(v)}% 能耗`}</span>
                ) },
                { title: '压力合格率预期', dataIndex: 'expectedPressureQualifyPct', width: 130, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 99.5 ? '#52c41a' : '#ff4d4f' }}>{v}%</span> },
                { title: '风险', render: (_, r: SchedulePlan) => <Space size={4}><RiskTag r={r.risks.surgeRisk} text={`喘振:${riskTxt(r.risks.surgeRisk)}`} /><RiskTag r={r.risks.overloadRisk} text={`过载:${riskTxt(r.risks.overloadRisk)}`} /><RiskTag r={r.risks.healthRisk} text={`健康:${riskTxt(r.risks.healthRisk)}`} /></Space> },
                { title: '预计能耗', width: 130, align: 'right' as const, render: (_, r: SchedulePlan) => <span className="mono">{r.expectedEnergyKwh.toLocaleString()} kWh</span> },
                { title: '操作', width: 150, render: (_, r: SchedulePlan) => (
                  <Space size={4}>
                    <Button size="small" type="primary" disabled={!canApprove} onClick={() => { approvePlan(r.id); message.success('方案已批准，请到执行中心下发') }}>批准</Button>
                    <Button size="small" danger disabled={!canApprove} onClick={() => { setRejectTarget(r); setRejectReason('') }}>驳回</Button>
                  </Space>
                ) },
              ]}
            />
          </Card>

          {/* 方案详情 */}
          {candidates.map(p => (
            <PlanDetailCard
              key={p.id} plan={p}
              canApprove={canApprove}
              onApprove={() => { approvePlan(p.id); message.success('方案已批准，请到执行中心下发') }}
              onReject={() => { setRejectTarget(p); setRejectReason('') }}
              onEdit={() => setEditTarget(p)}
            />
          ))}
        </>
      )}

      {/* 已批准待下发 */}
      {approved.length > 0 && (
        <Alert
          style={{ marginTop: 12 }} type="success" showIcon icon={<SendOutlined />}
          message={`${approved.length} 套方案已批准待下发`}
          description={
            <Space direction="vertical" size={4}>
              {approved.map(p => <div key={p.id}>{p.name} —— 批准人 {p.approvedBy} {dayjs(p.approvedAt).format('MM-DD HH:mm')}</div>)}
              <Button type="primary" size="small" icon={<SendOutlined />} onClick={() => nav('/execution')}>进入执行中心下发</Button>
            </Space>
          }
        />
      )}

      {/* 驳回弹窗 */}
      <Modal
        title={`驳回方案：${rejectTarget?.name ?? ''}`} open={!!rejectTarget} onCancel={() => setRejectTarget(null)}
        okText="确认驳回" okButtonProps={{ danger: true }}
        onOk={() => {
          if (!rejectTarget) return
          if (rejectReason.trim().length < 10) { message.warning('驳回原因至少 10 个字，将进入策略学习记录'); return }
          rejectPlan(rejectTarget.id, rejectReason.trim())
          message.success('已驳回，原因已进入策略学习记录（将用于生成策略候选版本）')
          setRejectTarget(null)
        }}
      >
        <Alert type="info" showIcon style={{ marginBottom: 10 }}
          message="驳回原因会进入策略学习记录" description="系统将基于驳回原因（如“AC-02 轴承高温时段不宜抬升加载率”）自动生成策略候选版本的改进项，供管理员审批。" />
        <Input.TextArea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="请填写驳回原因（必填，至少 10 字）……" />
      </Modal>

      {/* 编辑弹窗 */}
      {editTarget && (
        <EditPlanModal
          plan={editTarget} onClose={() => setEditTarget(null)} devices={devices}
          onSave={(actions) => { updatePlanActions(editTarget.id, actions); message.success('方案参数已更新（保存为草稿态，仍需审批）'); setEditTarget(null) }}
        />
      )}

      <Modal title="历史方案批次" open={historyOpen} onCancel={() => setHistoryOpen(false)} footer={null} width={860}>
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={plans.filter(p => p.status !== 'pending_approval')}
          columns={[
            { title: '方案', dataIndex: 'name' },
            { title: '策略', width: 130, render: (_, r: SchedulePlan) => <StrategyTag s={r.strategy} /> },
            { title: '状态', width: 130, render: (_, r: SchedulePlan) => <PlanStatusTag s={r.status} /> },
            { title: '预计节能', width: 90, align: 'right' as const, render: (v: number) => `${v}%` },
            { title: '审批', width: 90, render: (_, r: SchedulePlan) => r.approvedBy ?? r.rejectedBy ?? '—' },
            { title: '详情', width: 80, render: (_, r: SchedulePlan) => <Button size="small" type="link" onClick={() => { setHistoryOpen(false); nav(r.status === 'reviewed' || r.status === 'executed' || r.status === 'unknown' ? '/execution' : '/scheduling') }}>查看</Button> },
          ]}
        />
      </Modal>
    </div>
  )
}

export function actionText(a: PlanAction): string {
  const d = a.deviceId
  if (a.action === 'stop') return `${d} 停机`
  if (a.action === 'start') return `${d} 启动 → 加载率 ${a.targetLoadRate}%`
  if (a.action === 'adjust_load') return `${d} 加载率 → ${a.targetLoadRate}%`
  return `${d} 压力设定 → ${a.targetPressureBar} bar`
}

const riskTxt = (r: string) => r === 'none' ? '无' : r === 'low' ? '低' : r === 'medium' ? '中' : '高'

function LoadForecastChart() {
  const opt = useMemo(() => ({
    xAxis: { type: 'category' as const, data: LOAD_FORECAST.map(p => p.time), ...AXIS_TIME },
    yAxis: { type: 'value' as const, name: 'm³/min', ...AXIS_VAL },
    series: [{
      type: 'line' as const, smooth: true, data: LOAD_FORECAST.map(p => p.forecastM3Min),
      areaStyle: { opacity: 0.15, color: '#1d4ed8' }, lineStyle: { color: '#1d4ed8', width: 2 }, itemStyle: { color: '#1d4ed8' },
      markPoint: { data: [{ type: 'max' }], symbolSize: 42, label: { fontSize: 10 } },
    }],
    tooltip: { trigger: 'axis', formatter: (ps: unknown) => `${(ps as { name: string }[])[0]?.name}<br/>预测负荷：<b>${(ps as { data: number }[])[0]?.data}</b> m³/min` },
  }), [])
  return <Chart option={opt} height={200} />
}

function PlanDetailCard({ plan: p, canApprove, onApprove, onReject, onEdit }: {
  plan: SchedulePlan; canApprove: boolean; onApprove: () => void; onReject: () => void; onEdit: () => void
}) {
  return (
    <Card
      size="small" style={{ marginBottom: 12, borderColor: p.strategy === 'balanced' ? '#1d4ed8' : undefined }}
      title={
        <Space wrap>
          <span>{p.name}</span>
          <StrategyTag s={p.strategy} />
          <PlanStatusTag s={p.status} />
          {p.strategy === 'balanced' && <Tag color="red">推荐</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<SaveOutlined />} onClick={onEdit}>编辑参数</Button>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} disabled={!canApprove} onClick={onApprove}>批准</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} disabled={!canApprove} onClick={onReject}>驳回</Button>
        </Space>
      }
    >
      {/* 状态流 */}
      <Steps
        size="small" style={{ marginBottom: 12, maxWidth: 860 }}
        current={p.status === 'rejected' ? 1 : p.status === 'draft' ? 0 : p.status === 'pending_approval' ? 1 : p.status === 'approved' ? 2 : 3}
        status={p.status === 'rejected' ? 'error' : 'process'}
        items={[
          { title: '草稿' },
          { title: p.status === 'rejected' ? '已驳回' : '待审批' },
          { title: '已批准' },
          { title: '下发/执行' },
          { title: '效果复盘' },
        ]}
      />

      <Row gutter={12}>
        <Col xs={24} md={14}>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 10 }}>
            <Descriptions.Item label="推荐启停机组" span={2}>
              {p.actions.map(a => <div key={a.deviceId + a.action} style={{ fontSize: 12.5 }}>{actionText(a)} —— <span style={{ color: 'rgba(0,0,0,0.55)' }}>{a.reason}</span></div>)}
            </Descriptions.Item>
            <Descriptions.Item label="生效时间">{dayjs(p.effectiveFrom).format('MM-DD HH:mm')} 起 · 持续 {p.durationHours}h</Descriptions.Item>
            <Descriptions.Item label="压力设定">母管压力带 0.78~0.84 bar（策略约束）</Descriptions.Item>
            <Descriptions.Item label="预计节能"><span style={{ color: p.expectedSavingsPct > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{p.expectedSavingsPct > 0 ? `${p.expectedSavingsPct}%（约 ${Math.round((p.baselineEnergyKwh - p.expectedEnergyKwh) * 0.8)} 元）` : `能耗 +${Math.abs(p.expectedSavingsPct)}%`}</span></Descriptions.Item>
            <Descriptions.Item label="压力合格率预期"><span style={{ color: p.expectedPressureQualifyPct >= 99.5 ? '#52c41a' : '#ff4d4f' }}>{p.expectedPressureQualifyPct}%</span></Descriptions.Item>
            <Descriptions.Item label="预计能耗">{p.expectedEnergyKwh.toLocaleString()} kWh / 基线 {p.baselineEnergyKwh.toLocaleString()} kWh</Descriptions.Item>
            <Descriptions.Item label="数据时段">{p.evidencePeriod}</Descriptions.Item>
          </Descriptions>
          <ExplainBlock title={`推荐依据与解释（引用数据时段：${p.evidencePeriod}）`} items={p.explanation} />
        </Col>
        <Col xs={24} md={10}>
          <Card size="small" type="inner" title="风险评估">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <div><Space size={4}>喘振风险 <RiskTag r={p.risks.surgeRisk} /></Space></div>
              <div><Space size={4}>过载风险 <RiskTag r={p.risks.overloadRisk} /></Space></div>
              <div><Space size={4}>健康风险 <RiskTag r={p.risks.healthRisk} /></Space></div>
              <Alert type={p.expectedPressureQualifyPct >= 99.5 ? 'success' : 'warning'} showIcon message={<span style={{ fontSize: 12.5 }}>压力风险：{p.risks.pressureRiskText}</span>} />
            </Space>
          </Card>
          <Card size="small" type="inner" title="审批信息" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)' }}>
              生成：{p.createdBy} · {dayjs(p.createdAt).format('MM-DD HH:mm')}<br />
              {p.approvedBy && <>批准：{p.approvedBy} · {dayjs(p.approvedAt).format('MM-DD HH:mm')}<br /></>}
              {p.rejectedBy && <><span style={{ color: '#ff4d4f' }}>驳回：{p.rejectedBy} · 原因：{p.rejectReason}</span></>}
              {!p.approvedBy && !p.rejectedBy && '等待值班员审批。AI 不会自动执行任何控制动作。'}
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  )
}

function EditPlanModal({ plan, onClose, onSave, devices }: {
  plan: SchedulePlan; onClose: () => void; onSave: (a: PlanAction[]) => void; devices: ReturnType<typeof useApp.getState>['devices']
}) {
  const [form] = Form.useForm()
  const initial: Record<string, number | undefined> = {}
  plan.actions.forEach((a, i) => {
    if (a.targetLoadRate !== undefined) initial[`lr_${i}`] = a.targetLoadRate
  })
  return (
    <Modal
      title={`编辑方案参数：${plan.name}`} open onCancel={onClose}
      onOk={() => {
        const values = form.getFieldsValue()
        const actions = plan.actions.map((a, i) => ({
          ...a,
          targetLoadRate: values[`lr_${i}`] !== undefined ? values[`lr_${i}`] : a.targetLoadRate,
        }))
        onSave(actions)
      }}
      okText="保存修改"
    >
      <Alert
        style={{ marginBottom: 10 }} type="info" showIcon icon={<InfoCircleOutlined />}
        message="编辑后仍需审批后才能下发" description="人工调整会记录到策略学习记录（用于生成策略候选版本）。建议加载率保持在经济区间：离心机 75%~85%，螺杆机 60%~75%。" />
      <Form form={form} initialValues={initial} layout="vertical">
        {plan.actions.map((a, i) => {
          const dev = devices.find(d => d.id === a.deviceId)
          const isLoad = a.action === 'start' || a.action === 'adjust_load'
          const lr = (isLoad ? (initial[`lr_${i}`] ?? a.targetLoadRate ?? 0) : 0) as number
          return (
            <Form.Item key={i} label={`${actionText(a)}（${dev?.name ?? a.deviceId}）`} style={{ marginBottom: 10 }}>
              {isLoad ? (
                <Form.Item name={`lr_${i}`} noStyle>
                  <InputNumber min={20} max={95} style={{ width: 140 }} />
                </Form.Item>
              ) : (
                <Tag>停机指令（无参数）</Tag>
              )}
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>
                {dev && isLoad
                  ? `校核提示：目标产气 ${((dev.ratedFlowM3Min * lr) / 100).toFixed(1)} m³/min，目标比功率 ${specificPowerAt(dev, lr)} kW/(m³/min)（${dev.kind === 'centrifugal' ? '经济区间 75%~85%' : '经济区间 60%~75%'}）`
                  : '停机后机组进入待机，可随时重新启动'}
              </div>
            </Form.Item>
          )
        })}
      </Form>
    </Modal>
  )
}
