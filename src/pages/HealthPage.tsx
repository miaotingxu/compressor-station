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
import { DIAGNOSES, DEMO_NOW } from '../data/initial'
import type { RetestMetric, RiskLevel, WorkOrder } from '../types'
import dayjs from 'dayjs'

const PRIORITY_TAG: Record<string, { c: string; t: string }> = {
  low: { c: 'default', t: '低' }, medium: { c: 'blue', t: '中' }, high: { c: 'gold', t: '高' }, critical: { c: 'red', t: '紧急' },
}

export default function HealthPage() {
  const nav = useNavigate()
  const { devices, workOrders, createWorkOrder, assignWorkOrder, startWorkOrder, submitRetest, acceptWorkOrder, me, currentRole } = useApp()
  const [selected, setSelected] = useState('AC-02')
  const [woTarget, setWoTarget] = useState<string | null>(null)
  const [retestTarget, setRetestTarget] = useState<WorkOrder | null>(null)
  const [acceptTarget, setAcceptTarget] = useState<WorkOrder | null>(null)
  const [acceptText, setAcceptText] = useState('')
  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null)
  const [assignee, setAssignee] = useState('刘强')

  const dev = devices.find(d => d.id === selected)!
  const dg = DIAGNOSES.find(x => x.deviceId === selected)
  const canManageWo = currentRole === 'device_engineer'
  const surgeDev = devices.find(d => d.id === 'AC-01')!

  const abnormalDevices = devices.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')
  const openWo = workOrders.filter(w => w.status !== 'closed')

  // 选中的设备监测趋势（模拟 24h）
  const trend = useMemo(() => {
    const pts = 48
    const base = selected === 'AC-02' ? { vib: 5.2, temp: 82 } : selected === 'AC-01' ? { vib: 2.8, temp: 68 } : { vib: 1.8, temp: 60 }
    return Array.from({ length: pts }, (_, i) => {
      const t = DEMO_NOW.subtract((pts - i) * 0.5, 'hour')
      const rise = selected === 'AC-02' ? i * 0.033 : selected === 'AC-01' ? i * 0.006 : 0
      return {
        time: t.format('HH:mm'),
        vib: +(base.vib + rise + Math.sin(i / 5) * 0.3).toFixed(2),
        temp: +(base.temp + rise * 18 + Math.sin(i / 7) * 1.5).toFixed(1),
      }
    })
  }, [selected])

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

      {/* 喘振风险专区 */}
      <Alert
        style={{ marginBottom: 12 }} type={surgeDev.surgeRisk === 'high' ? 'error' : 'warning'} showIcon icon={<ThunderboltOutlined />}
        message={
          <Space wrap>
            <b>喘振风险专区 · AC-01 离心式空压机</b>
            <RiskTag r={surgeDev.surgeRisk} />
            <Tag color="red">预计预警提前时间 45 秒（目标 ≥30 秒）</Tag>
          </Space>
        }
        description={
          <div style={{ fontSize: 12.5 }}>
            <div>当前裕度 <b>8.6%</b>（安全阈值 10%）：机前压力 0.82 bar、导叶开度 62% 时喘振点流量 201 m³/min，当前流量 {surgeDev.flowM3Min} m³/min。近 7 日裕度从 14.2% 收窄，与进口滤网压差上升（4.2 kPa）相关。</div>
            <div style={{ marginTop: 4 }}>建议操作：① 立即在「数据与策略」页提高防喘振控制器裕度设定至 12%；② 8 小时内安排清理/更换进口滤网（<a onClick={() => nav('/health')}>工单 WO-20260921-003</a>）；③ 调度已对 AC-01 加载率做喘振约束校核（85% 加载率下裕度恢复 10.2%）。</div>
          </div>
        }
        action={<Button size="small" type="primary" danger onClick={() => { setSelected('AC-01') }}>查看喘振诊断详情</Button>}
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
                    {(d.id === 'AC-02') && <Tag color="red" style={{ fontSize: 11 }}>轴承磨损早期</Tag>}
                    {(d.id === 'AC-01') && <Tag color="red" style={{ fontSize: 11 }}>喘振裕度低</Tag>}
                    {(d.id === 'AC-03') && <Tag color="gold" style={{ fontSize: 11 }}>低载运行</Tag>}
                    {(d.id === 'AC-04' || d.id === 'AC-05') && <Tag style={{ fontSize: 11 }}>{d.status === 'standby' ? '热备' : '大修中'}</Tag>}
                  </div>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="预测性维护预警提前时间" value={36} suffix="小时" valueStyle={{ color: '#52c41a' }} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>目标 ≥24h · 案例：AC-02 轴承（DG-20260921-002）</div>
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
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>近 24 小时振动与轴承温度趋势（模拟数据，10min 粒度）。红色虚线为报警阈值。</div>
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

          <Card size="small" style={{ marginTop: 12 }} title="报警历史（AC-02 示例）">
            <Timeline
              items={[
                { color: 'red', children: <span>09-21 {dayjs().subtract(4, 'hour').format('HH:mm')} 轴承温度 88℃ 超阈值（持续） → 触发紧急告警 AL-20260921-002</span> },
                { color: 'orange', children: '09-20 14:10 振动 6.8 mm/s 上升趋势（7 日 +62%） → AL-20260919-005 转工单' },
                { color: 'orange', children: '09-18 09:42 包络谱 2×/4× 轴频幅值异常增长 → 预测模型标记"轴承磨损早期"' },
                { color: 'green', children: '09-05 08:20 例行点检正常（振动 4.2 mm/s）' },
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
          <Input placeholder="例如：AC-01 进口滤网清理与防喘阀校验" />
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
    'AC-02': [
      { name: '轴承温度', before: '88℃', after: '69℃', pass: true },
      { name: '振动速度', before: '6.8 mm/s', after: '3.8 mm/s', pass: true },
      { name: '油压', before: '0.29 bar', after: '0.31 bar', pass: true },
    ],
    'AC-01': [
      { name: '进口滤网压差', before: '4.2 kPa', after: '2.1 kPa', pass: true },
      { name: '喘振裕度', before: '8.6%', after: '13.2%', pass: true },
      { name: '振动速度', before: '3.1 mm/s', after: '2.9 mm/s', pass: true },
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
