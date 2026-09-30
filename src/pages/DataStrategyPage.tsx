import { useState } from 'react'
import {
  Card, Row, Col, Table, Tag, Button, Space, Modal, message, Descriptions, Statistic,
  Form, InputNumber, Input, Alert, Tooltip, Timeline, Switch, Empty,
} from 'antd'
import {
  DatabaseOutlined, ExperimentOutlined, SafetyOutlined, RollbackOutlined, CheckOutlined,
  CloseOutlined, WarningOutlined, ApiOutlined, LineChartOutlined, RobotOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp, useDataQualityBlock } from '../store/appStore'
import { Chart, AXIS_VAL } from '../components/Chart'
import { DemoAlertInline, StrategyStatusTag, SectionTitle, DemoTag } from '../components/common'
import { DEVICE_MAP } from '../data/initial'
import type { StrategyVersion } from '../types'
import dayjs from 'dayjs'

const SOURCE_STATUS: Record<string, { c: string; t: string }> = {
  online: { c: 'green', t: '在线' },
  degraded: { c: 'gold', t: '降级' },
  offline: { c: 'red', t: '离线' },
}

const ISSUE_TYPE: Record<string, string> = {
  field_missing: '字段缺失', stale_data: '数据陈旧', outlier: '异常值', no_data: '设备无数据',
}

export default function DataStrategyPage() {
  const nav = useNavigate()
  const {
    dataSources, dataIssues, strategies, resolveTodo, simulateDataOutage, toggleDataOutage,
    releaseStrategy, rollbackStrategy, rejectStrategy, me, currentRole,
  } = useApp()
  const dq = useDataQualityBlock()
  const [releaseTarget, setReleaseTarget] = useState<StrategyVersion | null>(null)
  const [rejectTarget, setRejectTarget] = useState<StrategyVersion | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rollbackTarget, setRollbackTarget] = useState<StrategyVersion | null>(null)
  const [curveDev, setCurveDev] = useState<string | null>(null)
  const [thresholdForm] = Form.useForm()

  const canManageStrategy = currentRole === 'admin'
  const activeStrategy = strategies.find(s => s.status === 'active')
  const dev = curveDev ? DEVICE_MAP[curveDev] : null

  const resolveIssue = (id: string) => {
    useApp.setState(s => ({ dataIssues: s.dataIssues.map(i => i.id === id ? { ...i, resolved: true } : i) }))
    resolveTodo(id, '数据质量问题已处理确认')
    message.success('数据质量问题已标记解决')
  }

  return (
    <div className="page-container">
      <h1 className="page-title">数据与策略<DemoTag /></h1>
      <div className="page-subtitle">数据源、字段映射、数据质量、性能曲线、阈值配置、策略版本与历史回放。数据质量不合格将自动阻断方案生成。</div>

      <DemoAlertInline />

      <Row gutter={12}>
        <Col xs={24} md={7}><Card size="small"><Statistic title="数据源在线" value={`${dataSources.filter(s => s.status === 'online').length}/${dataSources.length}`} prefix={<ApiOutlined />} /><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>DS-PLC-04 降级（AC-04 网关固件老旧）</div></Card></Col>
        <Col xs={24} md={7}><Card size="small"><Statistic title="数据完整率" value="99.2" suffix="%" /><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>近 24h 全点位统计</div></Card></Col>
        <Col xs={24} md={10}>
          <Card size="small" title="模拟数据异常（演示安全门禁）" extra={<Switch checked={simulateDataOutage} onChange={toggleDataOutage} checkedChildren="开启" unCheckedChildren="关闭" />}>
            <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)' }}>
              开启后模拟「SCADA 字段缺失 + 数据陈旧」，智能调度页将<b style={{ color: '#ff4d4f' }}>禁止生成可下发方案</b>并显示原因，用于验证安全规则。
            </div>
          </Card>
        </Col>
      </Row>

      {dq.blocked && (
        <Alert style={{ marginTop: 12 }} type="error" showIcon icon={<WarningOutlined />}
          message="当前数据质量不合格：方案生成已被阻断"
          description={<div style={{ fontSize: 12.5 }}>{dq.reasons.map((r, i) => <div key={i}>· {r}</div>)}</div>}
          action={<Button size="small" onClick={() => nav('/scheduling')}>去智能调度查看</Button>}
        />
      )}

      {/* 数据源 */}
      <SectionTitle>数据源与接入状态</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={dataSources}
          columns={[
            { title: '数据源', dataIndex: 'name', render: (v, r) => <div><b>{v}</b><div className="mono" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.id} · {r.endpoint}</div></div> },
            { title: '协议', dataIndex: 'protocol', width: 110 },
            { title: '状态', dataIndex: 'status', width: 90, render: s => <Tag color={SOURCE_STATUS[s].c}>{SOURCE_STATUS[s].t}</Tag> },
            { title: '最后同步', dataIndex: 'lastSyncAt', width: 150, render: v => <span className="mono" style={{ fontSize: 12 }}>{v}</span> },
            { title: '点位数', dataIndex: 'pointCount', width: 80, align: 'right' as const },
            { title: '质量', dataIndex: 'qualityPct', width: 130, render: (v: number) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 64, height: 5, background: '#f0f0f0', borderRadius: 3 }}><div style={{ width: `${v}%`, height: 5, borderRadius: 3, background: v > 98 ? '#52c41a' : v > 95 ? '#faad14' : '#ff4d4f' }} /></div>
                <span className="mono" style={{ fontSize: 12 }}>{v}%</span>
              </div>
            ) },
          ]}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
          字段映射：SCADA 点位 → 标准模型（母管压力/总流量/机组加载率等 412 点）由「数据接入向导」维护，演示环境已配置完成。
        </div>
      </Card>

      {/* 数据质量 */}
      <SectionTitle>数据质量问题（{dataIssues.filter(i => !i.resolved).length} 项未解决）</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={dataIssues}
          columns={[
            { title: '级别', dataIndex: 'severity', width: 80, render: s => <Tag color={s === 'critical' ? 'red' : 'gold'}>{s === 'critical' ? '严重' : '警告'}</Tag> },
            { title: '类型', dataIndex: 'type', width: 100, render: t => ISSUE_TYPE[t] ?? t },
            { title: '来源/设备', width: 130, render: (_, r) => <span className="mono" style={{ fontSize: 12 }}>{r.deviceId ?? r.source}</span> },
            { title: '详情', dataIndex: 'detail', render: d => <span style={{ fontSize: 12.5 }}>{d}</span> },
            { title: '是否阻断方案', dataIndex: 'blockPlan', width: 110, render: b => b ? <Tag color="red">阻断</Tag> : <Tag>不阻断</Tag> },
            { title: '状态', width: 100, render: (_, r) => r.resolved ? <Tag color="green">已解决</Tag> : <Tag color="gold">未解决</Tag> },
            { title: '操作', width: 110, render: (_, r) => !r.resolved ? (
              <Button size="small" onClick={() => resolveIssue(r.id)}>标记解决</Button>
            ) : <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{dayjs(r.detectedAt).format('MM-DD')} 发现</span> },
          ]}
        />
      </Card>

      {/* 性能曲线与阈值 */}
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}>
          <SectionTitle>设备性能曲线</SectionTitle>
          <Card size="small">
            <Space wrap style={{ marginBottom: 8 }}>
              {['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05'].map(id => (
                <Button key={id} size="small" type={curveDev === id ? 'primary' : 'default'} onClick={() => setCurveDev(id)}>{id}</Button>
              ))}
            </Space>
            {dev && dev.curve.length > 0 ? (
              <>
                <Chart height={230} option={{
                  grid: { left: 56, right: 20, top: 20, bottom: 40 },
                  xAxis: { type: 'value' as const, name: '加载率 %', min: 10, max: 100, ...AXIS_VAL },
                  yAxis: { type: 'value' as const, name: 'kW/(m³/min)', ...AXIS_VAL },
                  tooltip: { trigger: 'axis' },
                  series: [{ type: 'line' as const, smooth: true, data: dev.curve.map(c => [c.loadRate, c.specificPower]), lineStyle: { color: '#1d4ed8', width: 2 }, itemStyle: { color: '#1d4ed8' }, areaStyle: { opacity: 0.08 } }],
                }} />
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
                  {dev.id} {dev.model} 性能曲线（出厂性能试验 + 运行数据辨识拟合，演示数据）。可编辑曲线点后提交重新辨识（模拟）。
                  <Button size="small" type="link" style={{ padding: 0, marginLeft: 6 }} onClick={() => message.success('已提交曲线重新辨识任务（演示环境模拟）')}>提交重新辨识</Button>
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择设备" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <SectionTitle>阈值与喘振边界配置</SectionTitle>
          <Card size="small">
            <Form form={thresholdForm} layout="vertical" size="small" initialValues={{
              pressureLow: 0.78, pressureHigh: 0.84, surgeMargin: 10, bearingTemp: 85, vibration: 7.1, lowLoadThreshold: 50,
            }}>
              <Row gutter={12}>
                <Col span={8}><Form.Item label="母管压力合格带下沿 (bar)" name="pressureLow"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item></Col>
                <Col span={8}><Form.Item label="母管压力合格带上沿 (bar)" name="pressureHigh"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item></Col>
                <Col span={8}><Form.Item label="喘振安全裕度 (%)" name="surgeMargin"><InputNumber style={{ width: '100%' }} min={5} max={20} /></Form.Item></Col>
                <Col span={8}><Form.Item label="轴承温度报警阈值 (℃)" name="bearingTemp"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item label="振动报警阈值 (mm/s)" name="vibration"><InputNumber style={{ width: '100%' }} step={0.1} /></Form.Item></Col>
                <Col span={8}><Form.Item label="低载判定阈值 (%)" name="lowLoadThreshold"><InputNumber style={{ width: '100%' }} min={20} max={80} /></Form.Item></Col>
              </Row>
              <Space>
                <Button type="primary" size="small" disabled={currentRole !== 'admin'} onClick={() => { message.success('阈值已保存并写入审计日志（演示）'); useApp.getState().addAudit('阈值修改', '压力带/喘振裕度/报警阈值', `管理员 ${me().name} 更新阈值配置`) }}>保存配置</Button>
                {currentRole !== 'admin' && <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>仅系统管理员可修改（当前：{useApp.getState().roleOf()}）</span>}
              </Space>
            </Form>
            <Alert style={{ marginTop: 8 }} type="info" showIcon message={<span style={{ fontSize: 12.5 }}>喘振边界模型：surge-guard-v3.1 · 由性能试验数据训练，裕度阈值 10%，预警提前时间目标 ≥30 秒。</span>} />
          </Card>
        </Col>
      </Row>

      {/* 策略版本 */}
      <SectionTitle extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>版本流转：草稿 → 历史回放验证通过 → 待发布 → 生效中 → 已回滚/已归档 · 发布需人工审批</span>}>
        调度策略版本管理
      </SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={strategies}
          expandable={{
            defaultExpandedRowKeys: ['STG-V1.3.0-C'],
            expandedRowRender: (s: StrategyVersion) => (
              <div style={{ padding: 4 }}>
                <Descriptions size="small" column={2} bordered style={{ marginBottom: 8 }}>
                  <Descriptions.Item label="最小/最大加载率">{s.params.minLoadRatePct}% / {s.params.maxLoadRatePct}%</Descriptions.Item>
                  <Descriptions.Item label="压力带">{s.params.pressureBandBar[0]}~{s.params.pressureBandBar[1]} bar</Descriptions.Item>
                  <Descriptions.Item label="喘振裕度要求">≥{s.params.surgeMarginPct}%</Descriptions.Item>
                  <Descriptions.Item label="自学习">{s.params.autoLearnEnabled ? '开启' : '关闭'}</Descriptions.Item>
                  <Descriptions.Item label="策略优先级" span={2}>{s.params.priority === 'balanced' ? '稳供前提下节能' : s.params.priority === 'stability' ? '稳供优先' : s.params.priority === 'energy' ? '节能优先' : '设备保护优先'}</Descriptions.Item>
                </Descriptions>
                {s.replay && (
                  <Alert
                    type={s.replay.verdict === 'pass' ? 'success' : 'warning'} showIcon icon={<ExperimentOutlined />}
                    message={`历史回放验证 · ${s.replay.verdict === 'pass' ? '通过' : '未通过'}`}
                    description={
                      <div style={{ fontSize: 12.5 }}>
                        回放时段：{s.replay.period}<br />
                        指标：能效提升 {s.replay.energySavingPct}% · 压力合格率 {s.replay.pressureQualifyPct}% · 加载率偏离 ±{s.replay.loadRateDeviationPct}%<br />
                        {s.replay.notes}
                      </div>
                    }
                  />
                )}
              </div>
            ),
          }}
          columns={[
            { title: '版本', dataIndex: 'version', width: 120, render: (v, r: StrategyVersion) => <b className="mono">{v}</b> },
            { title: '名称', dataIndex: 'name', render: (v, r: StrategyVersion) => <div><div style={{ fontWeight: 500 }}>{v}</div><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{r.description.slice(0, 60)}…</div></div> },
            { title: '状态', dataIndex: 'status', width: 150, render: s => <StrategyStatusTag s={s} /> },
            { title: '创建', width: 150, render: (_, r: StrategyVersion) => <div style={{ fontSize: 12 }}>{r.createdBy}<div style={{ color: 'rgba(0,0,0,0.4)' }}>{dayjs(r.createdAt).format('MM-DD HH:mm')}</div></div> },
            { title: '回放', width: 90, render: (_, r: StrategyVersion) => r.replay ? <Tag color={r.replay.verdict === 'pass' ? 'green' : 'red'}>{r.replay.energySavingPct}%</Tag> : <Tag>未回放</Tag> },
            { title: '操作', width: 230, render: (_, s: StrategyVersion) => (
              <Space size={4} wrap>
                {s.status === 'replay_passed' && (
                  <Tooltip title={canManageStrategy ? '发布为生效版本' : '仅系统管理员可发布'}>
                    <Button size="small" type="primary" icon={<CheckOutlined />} disabled={!canManageStrategy} onClick={() => setReleaseTarget(s)}>发布</Button>
                  </Tooltip>
                )}
                {s.status === 'draft' && (
                  <Tooltip title={canManageStrategy ? '退回草稿后可提交回放' : '仅系统管理员可操作'}>
                    <Button size="small" icon={<ExperimentOutlined />} disabled={!canManageStrategy} onClick={() => message.success('已提交 14 天历史回放验证（演示环境模拟执行，回放指标见展开详情）')}>提交回放</Button>
                  </Tooltip>
                )}
                {s.status === 'active' && (
                  <Tooltip title={canManageStrategy ? '回滚到历史版本' : '仅系统管理员可回滚'}>
                    <Button size="small" danger icon={<RollbackOutlined />} disabled={!canManageStrategy} onClick={() => setRollbackTarget(s)}>回滚</Button>
                  </Tooltip>
                )}
                {(s.status === 'replay_passed') && (
                  <Tooltip title={canManageStrategy ? '驳回退回草稿' : '仅系统管理员可驳回'}>
                    <Button size="small" icon={<CloseOutlined />} disabled={!canManageStrategy} onClick={() => { setRejectTarget(s); setRejectNote('') }}>驳回</Button>
                  </Tooltip>
                )}
              </Space>
            ) },
          ]}
        />
        <Alert style={{ marginTop: 10 }} type="info" showIcon icon={<RobotOutlined />}
          message="策略学习引擎（自适应迭代）"
          description={<span style={{ fontSize: 12.5 }}>系统持续收集人工修改记录、方案驳回原因与执行效果，周期性生成策略候选版本（当前迭代周期 5 天，目标 ≤7 天）。候选版本必须通过历史回放验证并经管理员审批发布后才会生效，支持一键回滚。示例：V1.2.1-候选 来自 09-20 的方案驳回原因。</span>}
        />
      </Card>

      {/* 发布确认 */}
      <Modal
        title={`发布策略版本 ${releaseTarget?.version ?? ''}`} open={!!releaseTarget} onCancel={() => setReleaseTarget(null)}
        okText="确认发布"
        onOk={() => { if (releaseTarget) { releaseStrategy(releaseTarget.id); message.success(`已发布 ${releaseTarget.version} 为生效版本，原版本自动归档`) } setReleaseTarget(null) }}
      >
        {releaseTarget && (
          <>
            <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="发布前请确认回放验证结果" />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="版本">{releaseTarget.version} · {releaseTarget.name}</Descriptions.Item>
              <Descriptions.Item label="回放结果">{releaseTarget.replay ? `${releaseTarget.replay.period}：能效 +${releaseTarget.replay.energySavingPct}%，合格率 ${releaseTarget.replay.pressureQualifyPct}%，通过` : '未回放（不可发布）'}</Descriptions.Item>
              <Descriptions.Item label="关键参数变化">{releaseTarget.baseOnVersion ? `基于 ${releaseTarget.baseOnVersion}：低载识别阈值 ${(activeStrategy?.params.minLoadRatePct ?? 55)}%→${releaseTarget.params.minLoadRatePct}%，喘振裕度 ${(activeStrategy?.params.surgeMarginPct ?? 10)}%→${releaseTarget.params.surgeMarginPct}%` : '—'}</Descriptions.Item>
              <Descriptions.Item label="发布人">{me().name}（系统管理员）</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      {/* 回滚确认 */}
      <Modal
        title={`回滚生效版本 ${rollbackTarget?.version ?? ''}`} open={!!rollbackTarget} onCancel={() => setRollbackTarget(null)}
        okText="确认回滚" okButtonProps={{ danger: true }}
        onOk={() => {
          if (rollbackTarget) {
            const archived = strategies.find(s => s.status === 'archived' || (s.id !== rollbackTarget.id && s.status === 'rolled_back'))
            rollbackStrategy(archived?.id ?? rollbackTarget.id)
            message.success(`已回滚至 ${archived?.version ?? 'V1.1.0'}，${rollbackTarget.version} 标记为已回滚`)
          }
          setRollbackTarget(null)
        }}
      >
        <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="回滚将立即影响新方案的生成逻辑" description="回滚操作会写入审计日志；被回滚版本将标记为「已回滚」并保留完整历史。" />
      </Modal>

      {/* 驳回 */}
      <Modal
        title={`驳回策略版本 ${rejectTarget?.version ?? ''}`} open={!!rejectTarget} onCancel={() => setRejectTarget(null)}
        okText="确认驳回"
        onOk={() => {
          if (!rejectNote.trim()) { message.warning('请填写驳回原因'); return }
          if (rejectTarget) { rejectStrategy(rejectTarget.id, rejectNote.trim()); message.success('已驳回，退回草稿，原因进入策略学习记录') }
          setRejectTarget(null)
        }}
      >
        <Input.TextArea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="驳回原因（必填），例如：夜间轮换幅度过大，建议补充储气罐压力下限约束后再回放" />
      </Modal>

      {/* 回放记录 */}
      <SectionTitle>历史回放记录</SectionTitle>
      <Card size="small">
        <Timeline
          items={[
            { color: 'green', children: <span><b>V1.3.0-候选</b> 回放：{strategies.find(s => s.id === 'STG-V1.3.0-C')?.replay?.period} · 能效 +7.3% / 合格率 99.6% / 偏离 ±3.8% · <Tag color="green">通过</Tag></span> },
            { color: 'green', children: <span><b>V1.2.0</b> 回放：2026-08-06 ~ 08-19 · 能效 +6.4% / 合格率 99.7% / 偏离 ±5.1% · <Tag color="green">通过</Tag> → 已发布生效</span> },
            { color: 'red', children: <span><b>V1.1.1（废弃）</b> 回放：2026-08-01 ~ 08-05 · 压力合格率 99.2%（低于 99.5% 目标）· <Tag color="red">未通过</Tag> → 退回草稿后废弃</span> },
          ]}
        />
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>回放引擎：将候选策略作用于历史 14 天负荷曲线，逐时段推演机组组合并计算指标（模拟回放结果，用于发布前人工审批依据）。</div>
      </Card>
    </div>
  )
}
