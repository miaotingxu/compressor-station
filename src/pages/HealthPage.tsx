import { useMemo, useState } from 'react'
import {
  Card, Row, Col, Button, Tag, Space, Modal, message, Table, Statistic, Descriptions, Input,
  Form, Select, Alert, Timeline, InputNumber, Tooltip, Empty, Divider,
} from 'antd'
import {
  HeartOutlined, FileTextOutlined, WarningOutlined, ExperimentOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined, UserAddOutlined, CheckCircleOutlined, FileDoneOutlined, RobotOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { Chart, AXIS_VAL } from '../components/Chart'
import {
  DemoAlertInline, HealthBadge, RiskTag, WoStatusTag, SectionTitle, ExplainBlock, DemoTag, DeviceStatusTag,
} from '../components/common'
import { DIAGNOSES } from '../data/initial'
import { REAL } from '../data/realDataset'
import { nearestIndex } from '../data/stationTime'
import type { RetestMetric, RiskLevel, WorkOrder } from '../types'
import dayjs from 'dayjs'

const PRIORITY_TAG: Record<string, { c: string; t: string }> = {
  low: { c: 'default', t: '低' }, medium: { c: 'blue', t: '中' }, high: { c: 'gold', t: '高' }, critical: { c: 'red', t: '紧急' },
}

export default function HealthPage() {
  const nav = useNavigate()
  const { devices, workOrders, createWorkOrder, assignWorkOrder, startWorkOrder, submitRetest, acceptWorkOrder, me, currentRole, dataTime } = useApp()
  const [selected, setSelected] = useState('AC-04')
  const [woTarget, setWoTarget] = useState<string | null>(null)
  const [retestTarget, setRetestTarget] = useState<WorkOrder | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<WorkOrder | null>(null)
  const [acceptText, setAcceptText] = useState('')
  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null)
  const [assignee, setAssignee] = useState('刘强')

  const dev = devices.find(d => d.id === selected)!
  const dg = DIAGNOSES.find(x => x.deviceId === selected)
  const canManageWo = currentRole === 'device_engineer'
  const surgeDev = devices.find(d => d.id === 'AC-05') ?? devices[0]

  const abnormalDevices = devices.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')
  const openWo = workOrders.filter(w => w.status !== 'closed')

  // 选中设备的监测趋势：取真实时序中截至数据时刻的最近 48 小时
  const trend = useMemo(() => {
    const d = REAL.series.devices[selected]
    if (!d) return []
    const end = nearestIndex(dataTime)
    const start = Math.max(0, end - 47)
    const out: { time: string; vib: number; temp: number }[] = []
    for (let i = start; i <= end; i++) {
      out.push({
        time: dayjs(REAL.series.times[i]).format('MM-DD HH:mm'),
        vib: d.vibration[i],
        temp: d.bearingTempC[i],
      })
    }
    return out
  }, [selected, dataTime])

  const trendOpt = {
    xAxis: { type: 'category' as const, data: trend.map(p => p.time), axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value' as const, name: 'mm/s', ...AXIS_VAL },
      { type: 'value' as const, name: '℃', ...AXIS_VAL, splitLine: { show: false } },
    ],
    legend: { top: 2, textStyle: { fontSize: 11 } },
    series: [
      { name: '振动速度', type: 'line' as const, data: trend.map(p => p.vib), smooth: true, showSymbol: false, itemStyle: { color: '#722ed1' }, markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: '报警 7.1', fontSize: 10 }, data: [{ yAxis: 7.1 }] } },
      { name: '轴承温度', type: 'line' as const, yAxisIndex: 1, data: trend.map(p => p.temp), smooth: true, showSymbol: false, itemStyle: { color: '#fa8c16' }, markLine: { silent: true, symbol: 'none', yAxisIndex: 1, lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: '阈值 85', fontSize: 10 }, data: [{ yAxis: 85 }] } },
    ],
  }

  return (
    <div className="page-container">
      <h1 className="page-title">设备健康与预测运维<DemoTag text="诊断结论由模拟推理引擎生成" /></h1>
      <div className="page-subtitle">健康评分、振动/温度/电流趋势、诊断证据链、喘振风险与维修工单闭环。</div>

      <DemoAlertInline />

      {/* 振动 / 温升风险专区 */}
      <Alert
        style={{ marginBottom: 12 }} type={surgeDev.surgeRisk === 'high' ? 'error' : 'warning'} showIcon icon={<ThunderboltOutlined />}
        message={
          <Space wrap>
            <b>振动 / 温升风险专区 · 5# 离心式空压机</b>
            <RiskTag r={surgeDev.surgeRisk} />
            <Tag color="red">二级振动均值约 9.1 mm/s（C 区下限 7.1）</Tag>
          </Space>
        }
        description={
          <div style={{ fontSize: 12.5 }}>
            <div>5# 二级转子振动全周期均值 <b>9.08 mm/s</b>、峰值 25.15 mm/s，高于 ISO 10816 C 区下限；一级/三级振动约 3.5 / 3.9 mm/s，指向二级转子。当前流量 {surgeDev.flowM3Min} m³/min、排气压力 {surgeDev.pressureBar} bar。</div>
            <div style={{ marginTop: 4 }}>建议操作：① 72h 内安排二级转子振动频谱复测；② 核查轴承润滑与对中（<a onClick={() => nav('/health')}>工单 WO-20260912-001</a>）；③ 调度对 5# 加载率做振动约束校核，避免长期高位运行。</div>
          </div>
        }
        action={<Button size="small" type="primary" danger onClick={() => { setSelected('AC-05') }}>查看振动诊断详情</Button>}
      />

      {/* 健康总览 */}
      <Row gutter={12}>
        <Col xs={24} md={18}>
          <Card size="small" title={<Space><HeartOutlined /> 设备健康总览</Space>} extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>点击设备查看详情与诊断</span>}>
            <Space size={8} wrap>
              {abnormalDevices.map(d => (
                <Card
                  key={d.id} size="small" hoverable onClick={() => setSelected(d.id)}
                  style={{ width: 190, borderColor: selected === d.id ? '#1d4ed8' : undefined, borderWidth: selected === d.id ? 2 : 1 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>{d.id}</b><HealthBadge score={d.healthScore} />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 4 }}>
                    振动 {d.status === 'running' ? `${d.vibration} mm/s` : '—'} · 轴温 {d.status === 'running' ? `${d.bearingTempC}℃` : '—'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {d.vibration > 7.1 && <Tag color="red" style={{ fontSize: 11 }}>振动偏高</Tag>}
                    {d.exhaustTempC >= 100 && <Tag color="gold" style={{ fontSize: 11 }}>排气温度高</Tag>}
                    {d.status !== 'running' && <Tag style={{ fontSize: 11 }}>停机</Tag>}
                  </div>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="预测性维护预警提前时间" value={72} suffix="小时" valueStyle={{ color: '#52c41a' }} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>目标 ≥24h · 案例：5# 二级振动（DG-20260912-001）</div>
            <Divider style={{ margin: '10px 0' }} />
            <Statistic title="进行中工单" value={openWo.length} suffix="单" />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>未复测/未验收工单不允许直接关闭</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        {/* 左：设备详情 */}
        <Col xs={24} lg={14}>
          <Card size="small" title={<Space>{dev.id} {dev.name}<DeviceStatusTag s={dev.status} /></Space>}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="健康评分"><HealthBadge score={dev.healthScore} /></Descriptions.Item>
              <Descriptions.Item label="累计运行">{dev.runningHours.toLocaleString()} h</Descriptions.Item>
              <Descriptions.Item label="振动速度"><span style={{ color: dev.vibration > 4.5 ? '#ff4d4f' : undefined }}>{dev.status === 'running' ? `${dev.vibration} mm/s` : '—'}</span></Descriptions.Item>
              <Descriptions.Item label="轴承温度"><span style={{ color: dev.bearingTempC > 85 ? '#ff4d4f' : undefined }}>{dev.status === 'running' ? `${dev.bearingTempC} ℃` : '—'}</span></Descriptions.Item>
              <Descriptions.Item label="绕组温度">{dev.status === 'running' ? `${dev.windingTempC} ℃` : '—'}</Descriptions.Item>
              <Descriptions.Item label="电流">{dev.status === 'running' ? `${dev.currentA} A` : '—'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <Chart option={trendOpt} height={220} />
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>截至数据时刻的最近 48 小时振动与轴承温度趋势（主办方真实数据，小时级）。红色虚线为报警阈值。</div>
            </div>
          </Card>

          {dg && (
            <Card
              size="small" style={{ marginTop: 12 }}
              title={<Space><RobotOutlined /> AI 诊断结论 <RiskTag r={dg.riskLevel as RiskLevel} /><Tag color="blue">{dg.modelVersion}</Tag></Space>}
              extra={
                (dg.riskLevel === 'high' || dg.riskLevel === 'medium') && !workOrders.some(w => w.relatedDiagnosisId === dg.id && w.status !== 'closed') && (
                  <Button
                    size="small" type="primary" icon={<FileTextOutlined />}
                    onClick={() => setWoTarget(dg.id)}
                  >一键创建维修工单</Button>
                )
              }
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{dg.conclusion}</div>
              <ExplainBlock title="诊断证据链" items={dg.evidence} />
              <Row gutter={12} style={{ marginTop: 10 }}>
                <Col span={12}>
                  <Card size="small" type="inner" title="可能原因">
                    <ul className="evidence-list" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{dg.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" type="inner" title="建议动作">
                    <ul className="evidence-list" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{dg.suggestedActions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </Card>
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {/* 右：工单 */}
        <Col xs={24} lg={10}>
          <Card size="small" title={<Space><FileDoneOutlined /> 维修工单（全流程闭环）</Space>} extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>已创建 → 已指派 → 处理中 → 待复测 → 已验收关闭</span>}>
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={workOrders}
              expandable={{
                defaultExpandedRowKeys: ['WO-20260920-002'],
                expandedRowRender: (w: WorkOrder) => <WorkOrderDetail wo={w} canManageWo={canManageWo} onAssign={() => setAssignTarget(w)} onStart={() => { startWorkOrder(w.id); message.success('工单已开工') }} onRetest={() => setRetestTarget(w)} onAccept={() => { setAcceptTarget(w); setAcceptText('') }} />,
              }}
              columns={[
                { title: '工单', dataIndex: 'id', width: 150, render: (v, r: WorkOrder) => <div><span className="mono" style={{ fontSize: 12 }}>{v}</span><div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.deviceId}</div></div> },
                { title: '标题', dataIndex: 'title', render: (v, r: WorkOrder) => <div style={{ fontSize: 12.5 }}>{v}</div> },
                { title: '优先级', dataIndex: 'priority', width: 70, render: p => <Tag color={PRIORITY_TAG[p].c}>{PRIORITY_TAG[p].t}</Tag> },
                { title: '状态', dataIndex: 'status', width: 110, render: s => <WoStatusTag s={s} /> },
              ]}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              <SafetyCertificateOutlined /> 规则：提交复测指标并填写验收结论后方可关闭工单；复测不通过将退回「处理中」。
            </div>
          </Card>

          <Card size="small" style={{ marginTop: 12 }} title="报警历史（基于真实数据统计）">
            <Timeline
              items={[
                { color: 'red', children: '全周期 5# 二级振动均值 9.08 mm/s、峰值 25.15 mm/s → 触发振动告警 AL-20260912-001' },
                { color: 'orange', children: '全周期 4# 排气温度峰值 115℃、绕组峰值 90℃ → 温升告警 AL-20260912-002' },
                { color: 'orange', children: '4#/5# B 相电流全程为 0 → 数据质量告警 AL-20260912-003' },
                { color: 'orange', children: '4# 停机时长占比约 17.6% → 负载不均衡告警 AL-20260912-004' },
                { color: 'green', children: '压力合格率约 94.8%（母管压力 5.0~6.4 bar）' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 创建工单弹窗 */}
      <CreateWoModal
        open={!!woTarget}
        dgId={woTarget}
        devices={devices}
        onClose={() => setWoTarget(null)}
        onCreate={(input) => {
          const id = createWorkOrder(input)
          message.success(`工单 ${id} 已创建，请在工单列表中指派`)
          setWoTarget(null)
        }}
      />

      {/* 指派 */}
      <Modal
        title={`指派工单 ${assignTarget?.id ?? ''}`} open={!!assignTarget} onCancel={() => setAssignTarget(null)}
        onOk={() => { assignWorkOrder(assignTarget!.id, assignee); message.success(`已指派给 ${assignee}`); setAssignTarget(null) }}
        okText="确认指派"
      >
        <Select style={{ width: 240 }} value={assignee} onChange={setAssignee} options={[
          { value: '刘强', label: '刘强（设备工程师 · 机械）' },
          { value: '赵勇', label: '赵勇（设备工程师 · 大修）' },
        ]} />
      </Modal>

      {/* 复测提交 */}
      <RetestModal
        wo={retestTarget}
        onClose={() => setRetestTarget(null)}
        onSubmit={(metrics, record) => {
          if (retestTarget) { submitRetest(retestTarget.id, metrics, record); message.success('复测数据已提交，工单进入待验收状态') }
          setRetestTarget(null)
        }}
      />

      {/* 验收 */}
      <Modal
        title={`验收关闭工单 ${acceptTarget?.id ?? ''}`} open={!!acceptTarget} onCancel={() => setAcceptTarget(null)}
        okText="确认验收关闭"
        onOk={() => {
          if (!acceptText.trim()) { message.warning('验收结论为必填'); return }
          if (acceptTarget) {
            const ok = acceptWorkOrder(acceptTarget.id, acceptText.trim())
            if (ok) message.success('工单已验收关闭，闭环记录已归档')
            else message.error('关闭失败：缺少复测数据，不允许直接关闭')
          }
          setAcceptTarget(null)
        }}
      >
        {acceptTarget && (
          <>
            <Alert
              type={acceptTarget.retestMetrics.length ? 'success' : 'error'} showIcon style={{ marginBottom: 10 }}
              message={acceptTarget.retestMetrics.length ? `已有 ${acceptTarget.retestMetrics.length} 项复测指标合格` : '该工单尚无复测数据'}
              description={acceptTarget.retestMetrics.length ? '复测合格后可填写验收结论关闭工单。' : '按规则：没有复测数据和验收结论，不允许直接关闭工单。请先提交复测数据。'}
            />
            {acceptTarget.retestMetrics.length > 0 && (
              <Table
                size="small" rowKey="name" pagination={false} style={{ marginBottom: 10 }}
                dataSource={acceptTarget.retestMetrics}
                columns={[
                  { title: '复测指标', dataIndex: 'name' },
                  { title: '维修前', dataIndex: 'before' },
                  { title: '维修后', dataIndex: 'after', render: (v, r: RetestMetric) => <span style={{ color: r.pass ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v}</span> },
                  { title: '判定', dataIndex: 'pass', render: p => p ? <Tag color="green">合格</Tag> : <Tag color="red">不合格</Tag> },
                ]}
              />
            )}
            <Input.TextArea rows={3} value={acceptText} onChange={e => setAcceptText(e.target.value)} placeholder="验收结论（必填），例如：复测三项指标合格，试运行 24h 无异常，同意关闭。" />
          </>
        )}
      </Modal>
    </div>
  )
}

function WorkOrderDetail({ wo, canManageWo, onAssign, onStart, onRetest, onAccept }: {
  wo: WorkOrder; canManageWo: boolean
  onAssign: () => void; onStart: () => void; onRetest: () => void; onAccept: () => void
}) {
  return (
    <div style={{ padding: '4px 4px 0' }}>
      <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.65)', marginBottom: 8 }}>{wo.description}</div>
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 8 }}>
        <Descriptions.Item label="责任人">{wo.assignee || <Tag color="gold">待指派</Tag>}</Descriptions.Item>
        <Descriptions.Item label="计划时间">{wo.plannedAt ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="来源">{wo.source === 'diagnosis' ? 'AI 诊断' : wo.source === 'alert' ? '告警' : '手工'}</Descriptions.Item>
        <Descriptions.Item label="关联">{wo.relatedDiagnosisId ?? wo.relatedAlertId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="备件" span={2}>{wo.spareParts.length ? wo.spareParts.map(s => `${s.name}×${s.qty}`).join('；') : '—'}</Descriptions.Item>
        {wo.repairRecord && <Descriptions.Item label="维修记录" span={2}>{wo.repairRecord}</Descriptions.Item>}
      </Descriptions>
      {wo.retestMetrics.length > 0 && (
        <Table
          size="small" rowKey="name" pagination={false} style={{ marginBottom: 8 }}
          dataSource={wo.retestMetrics}
          columns={[
            { title: '复测指标', dataIndex: 'name' }, { title: '维修前', dataIndex: 'before' },
            { title: '维修后', dataIndex: 'after', render: (v, r: RetestMetric) => <span style={{ color: r.pass ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v}</span> },
            { title: '判定', dataIndex: 'pass', width: 70, render: p => p ? <Tag color="green">合格</Tag> : <Tag color="red">不合格</Tag> },
          ]}
        />
      )}
      {wo.status === 'closed' && (
        <Alert type="success" showIcon message={<span style={{ fontSize: 12.5 }}>验收结论：{wo.acceptance}</span>} style={{ marginBottom: 8 }} />
      )}
      <Space size={6} wrap>
        {wo.status === 'created' && <Button size="small" type="primary" icon={<UserAddOutlined />} disabled={!canManageWo} onClick={onAssign}>指派</Button>}
        {wo.status === 'assigned' && <Button size="small" type="primary" icon={<PlayCircleOutlined />} disabled={!canManageWo} onClick={onStart}>开工</Button>}
        {wo.status === 'processing' && <Button size="small" type="primary" icon={<ExperimentOutlined />} disabled={!canManageWo} onClick={onRetest}>提交复测数据</Button>}
        {wo.status === 'retest_pending' && <Button size="small" type="primary" icon={<CheckCircleOutlined />} disabled={!canManageWo} onClick={onAccept}>验收关闭</Button>}
        {wo.status === 'closed' && <Tag color="green"><CheckCircleOutlined /> 已闭环 · {dayjs(wo.closedAt).format('MM-DD')}</Tag>}
        {!canManageWo && wo.status !== 'closed' && <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>当前角色（{useApp.getState().roleOf()}）无工单操作权限，请切换为设备工程师</span>}
      </Space>
    </div>
  )
}

function CreateWoModal({ open, dgId, devices, onClose, onCreate }: {
  open: boolean; dgId: string | null; devices: ReturnType<typeof useApp.getState>['devices']
  onClose: () => void; onCreate: (input: Parameters<ReturnType<typeof useApp.getState>['createWorkOrder']>[0]) => void
}) {
  const [form] = Form.useForm()
  const dg = DIAGNOSES.find(d => d.id === dgId)
  return (
    <Modal
      title="创建维修工单（来自诊断结论）" open={open} onCancel={onClose}
      onOk={() => form.validateFields().then(v => { onCreate({ ...v, source: 'diagnosis', relatedDiagnosisId: dgId ?? undefined }); form.resetFields() })}
      okText="创建工单"
    >
      <Form form={form} layout="vertical" initialValues={dg ? { deviceId: dg.deviceId, description: dg.suggestedActions[0], priority: dg.riskLevel === 'high' ? 'critical' : 'medium' } : {}}>
        <Form.Item name="deviceId" label="设备" rules={[{ required: true }]}>
          <Select options={devices.filter(d => d.kind === 'centrifugal' || d.kind === 'screw').map(d => ({ value: d.id, label: `${d.id} ${d.name}` }))} />
        </Form.Item>
        <Form.Item name="title" label="工单标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="例如：5# 二级转子振动复测与轴承核查" />
        </Form.Item>
        <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
          <Select options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'critical', label: '紧急' }]} />
        </Form.Item>
        <Form.Item name="description" label="故障描述与建议" rules={[{ required: true, message: '请输入描述' }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        {dg && <Alert type="info" showIcon message="已自动关联诊断证据" description={dg.evidence[0]} />}
      </Form>
    </Modal>
  )
}

function RetestModal({ wo, onClose, onSubmit }: {
  wo: WorkOrder | null; onClose: () => void; onSubmit: (m: RetestMetric[], record: string) => void
}) {
  const [metrics, setMetrics] = useState<RetestMetric[]>([])
  const [record, setRecord] = useState('')
  if (!wo) return null
  const presets: Record<string, RetestMetric[]> = {
    'AC-05': [
      { name: '二级振动', before: '9.08 mm/s', after: '6.5 mm/s', pass: true },
      { name: '一级振动', before: '3.53 mm/s', after: '3.2 mm/s', pass: true },
      { name: '轴承温度', before: '41.4℃', after: '40.8℃', pass: true },
    ],
    'AC-04': [
      { name: '排气温度峰值', before: '115℃', after: '99℃', pass: true },
      { name: '冷却水进出温差', before: '14.2℃', after: '9.6℃', pass: true },
      { name: '绕组温度峰值', before: '90℃', after: '82℃', pass: true },
    ],
  }
  const init = () => { setMetrics(presets[wo.deviceId] ?? [{ name: '振动速度', before: '—', after: '3.6 mm/s', pass: true }]); setRecord('') }
  return (
    <Modal
      title={`提交复测数据：${wo.id}（${wo.deviceId}）`} open onCancel={onClose} afterOpenChange={o => o && init()}
      onOk={() => {
        if (!record.trim()) { message.warning('请填写维修记录'); return }
        const bad = metrics.find(m => !m.pass)
        if (bad) { message.error(`复测项「${bad.name}」不合格，请返工后重新提交（或调整复测值）`); return }
        onSubmit(metrics, record.trim())
      }}
      okText="提交复测"
    >
      <Alert type="info" showIcon style={{ marginBottom: 10 }} message="复测指标全部合格后，工单才能进入待验收状态" />
      {metrics.map((m, i) => (
        <Row gutter={8} key={i} style={{ marginBottom: 6 }} align="middle">
          <Col span={7}><Input size="small" value={m.name} onChange={e => setMetrics(ms => ms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="指标名" /></Col>
          <Col span={6}><Input size="small" value={m.before} onChange={e => setMetrics(ms => ms.map((x, j) => j === i ? { ...x, before: e.target.value } : x))} placeholder="维修前" /></Col>
          <Col span={6}><Input size="small" value={m.after} onChange={e => setMetrics(ms => ms.map((x, j) => j === i ? { ...x, after: e.target.value } : x))} placeholder="维修后" /></Col>
          <Col span={5}>
            <Select size="small" value={m.pass ? 'pass' : 'fail'} style={{ width: '100%' }} onChange={v => setMetrics(ms => ms.map((x, j) => j === i ? { ...x, pass: v === 'pass' } : x))} options={[{ value: 'pass', label: '合格' }, { value: 'fail', label: '不合格' }]} />
          </Col>
        </Row>
      ))}
      <Button size="small" type="dashed" block onClick={() => setMetrics(ms => [...ms, { name: '', before: '', after: '', pass: true }])}>+ 添加复测指标</Button>
      <Input.TextArea style={{ marginTop: 10 }} rows={3} value={record} onChange={e => setRecord(e.target.value)} placeholder="维修记录（必填）：更换驱动端轴承与润滑脂，试运行 2h 正常……" />
    </Modal>
  )
}
