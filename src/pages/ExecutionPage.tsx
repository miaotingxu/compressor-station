import { useState } from 'react'
import {
  Card, Row, Col, Button, Tag, Space, Modal, Input, message, Table, Timeline, Alert, Statistic,
  Descriptions, Empty, Tooltip, InputNumber,
} from 'antd'
import {
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, WarningOutlined,
  ReloadOutlined, FileSearchOutlined, AuditOutlined, PlayCircleOutlined, RobotOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { DemoAlertInline, PlanStatusTag, StrategyTag, SectionTitle, ExplainBlock, DemoTag, RiskTag } from '../components/common'
import { actionText } from './SchedulingPage'
import type { SchedulePlan } from '../types'
import dayjs from 'dayjs'

const RESULT_TAG: Record<string, { c: string; t: string; icon: React.ReactNode }> = {
  success: { c: 'green', t: '成功', icon: <CheckCircleOutlined /> },
  failed: { c: 'red', t: '失败', icon: <CloseCircleOutlined /> },
  timeout: { c: 'orange', t: '超时 · 状态未知', icon: <ClockCircleOutlined /> },
}

export default function ExecutionPage() {
  const nav = useNavigate()
  const { plans, dispatchPlan, resolveAbnormalPlan, auditLogs, me, currentRole } = useApp()
  const [dispatchTarget, setDispatchTarget] = useState<SchedulePlan | null>(null)
  const [manualTarget, setManualTarget] = useState<SchedulePlan | null>(null)
  const [manualNote, setManualNote] = useState('')
  const [logTarget, setLogTarget] = useState<SchedulePlan | null>(null)
  const [dispatching, setDispatching] = useState<string | null>(null)

  const canDispatch = currentRole === 'operator'
  const approvedPlans = plans.filter(p => p.status === 'approved')
  const activePlans = plans.filter(p => ['dispatching', 'unknown', 'executed', 'execute_failed'].includes(p.status))
  const reviewedPlans = plans.filter(p => p.status === 'reviewed')

  const doDispatch = async (p: SchedulePlan) => {
    setDispatching(p.id)
    setDispatchTarget(null)
    await dispatchPlan(p.id)
    setDispatching(null)
  }

  return (
    <div className="page-container">
      <h1 className="page-title">执行中心<DemoTag text="演示环境模拟控制 · 非真实 PLC 指令" /></h1>
      <div className="page-subtitle">
        已批准方案的逐设备执行过程与回执。任一关键设备回执失败或超时，整体方案将标记为「状态未知/执行异常」，并自动创建待办。
      </div>

      <DemoAlertInline>
        模拟控制 API：启机 / 停机 / 加载率调整 / 压力设定值调整。回执成功率由模拟网关状态决定（AC-04 网关固件老旧，约 30% 概率回执超时，用于演示异常闭环）。
      </DemoAlertInline>

      {/* 待下发 */}
      <SectionTitle>已批准 · 待下发</SectionTitle>
      {approvedPlans.length === 0 ? (
        <Card size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待下发方案。请先在「智能调度」页生成并批准方案。" /></Card>
      ) : (
        approvedPlans.map(p => (
          <Card key={p.id} size="small" style={{ marginBottom: 10 }}
            title={<Space><span>{p.name}</span><PlanStatusTag s={p.status} /><StrategyTag s={p.strategy} /></Space>}
            extra={<Button type="primary" icon={<SendOutlined />} disabled={!canDispatch || dispatching === p.id} onClick={() => setDispatchTarget(p)}>下发控制指令</Button>}
          >
            <div style={{ fontSize: 12.5 }}>
              {p.actions.map(a => <div key={a.deviceId + a.action}>· {actionText(a)}</div>)}
              <div style={{ marginTop: 6, color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>批准人：{p.approvedBy} · {dayjs(p.approvedAt).format('MM-DD HH:mm')} · 生效 {dayjs(p.effectiveFrom).format('MM-DD HH:mm')} 起 {p.durationHours}h</div>
            </div>
          </Card>
        ))
      )}

      {/* 下发中/已执行/异常 */}
      <SectionTitle>执行监控</SectionTitle>
      {activePlans.length === 0 && reviewedPlans.length === 0 && (
        <Card size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行记录" /></Card>
      )}

      {activePlans.map(p => (
        <Card
          key={p.id} size="small" style={{ marginBottom: 10 }}
          title={<Space><span>{p.name}</span><PlanStatusTag s={p.status} /><StrategyTag s={p.strategy} /></Space>}
          extra={
            <Space>
              {(p.status === 'unknown' || p.status === 'execute_failed') && (
                <>
                  <Tooltip title={canDispatch ? '重新下发全部指令' : '无下发权限'}>
                    <Button size="small" icon={<ReloadOutlined />} type="primary" ghost disabled={!canDispatch} onClick={() => { doDispatch(p) }}>重新下发</Button>
                  </Tooltip>
                  <Button size="small" disabled={!canDispatch} onClick={() => { setManualTarget(p); setManualNote('') }}>人工处置</Button>
                </>
              )}
              <Button size="small" icon={<FileSearchOutlined />} onClick={() => setLogTarget(p)}>查看日志</Button>
            </Space>
          }
        >
          {p.status === 'unknown' && (
            <Alert
              type="error" showIcon style={{ marginBottom: 10 }} icon={<WarningOutlined />}
              message="执行异常：存在失败/超时回执，整体方案不能标记为「已执行」"
              description="已自动创建异常待办。请核实现场设备实际状态后，选择「重新下发」或「人工处置」。按安全规则，回执超时时不得假定指令已生效。"
            />
          )}
          <Table
            size="small" rowKey={r => r.deviceId + r.command} pagination={false}
            dataSource={p.receipts ?? []}
            locale={{ emptyText: p.status === 'dispatching' ? '指令下发中，等待回执……' : '无回执记录' }}
            columns={[
              { title: '设备', dataIndex: 'deviceId', width: 90 },
              { title: '指令', dataIndex: 'command' },
              { title: '回执结果', dataIndex: 'result', width: 130, render: (r: string) => <Tag color={RESULT_TAG[r]?.c} icon={RESULT_TAG[r]?.icon}>{RESULT_TAG[r]?.t}</Tag> },
              { title: '耗时', dataIndex: 'latencyMs', width: 90, align: 'right' as const, render: (v: number) => <span className="mono">{(v / 1000).toFixed(1)}s</span> },
              { title: '回执时间', dataIndex: 'finishedAt', width: 150, render: (v: string) => <span className="mono" style={{ fontSize: 12 }}>{dayjs(v).format('MM-DD HH:mm:ss')}</span> },
              { title: '消息', dataIndex: 'message', render: (m: string) => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{m}</span> },
            ]}
          />
          {p.status === 'dispatching' && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: '#1d4ed8' }}>
              <PlayCircleOutlined spin /> 正在逐设备下发指令并等待回执（演示环境模拟控制）……
            </div>
          )}
        </Card>
      ))}

      {/* 效果复盘 */}
      {reviewedPlans.map(p => p.review && (
        <Card key={p.id} size="small" style={{ marginBottom: 10 }}
          title={<Space><span>{p.name}</span><PlanStatusTag s={p.status} /></Space>}
          extra={<Tag color="green" icon={<CheckCircleOutlined />}>效果复盘完成</Tag>}
        >
          <Row gutter={12}>
            <Col xs={12} md={4}><Statistic title="实际节电" value={p.review.energySavingKwh} suffix="kWh" valueStyle={{ color: '#52c41a' }} /></Col>
            <Col xs={12} md={4}><Statistic title="能效提升" value={p.review.energySavingPct} precision={1} suffix="%" valueStyle={{ color: '#52c41a' }} /></Col>
            <Col xs={12} md={4}><Statistic title="压力合格率" value={p.review.pressureQualifyPct} suffix="%" precision={1} /></Col>
            <Col xs={12} md={4}><Statistic title="加载率偏离" value={p.review.loadRateDeviationPct} suffix="%" precision={1} /></Col>
            <Col xs={12} md={4}><Statistic title="节约电费" value={p.review.savingsAmountYuan} prefix="¥" /></Col>
            <Col xs={12} md={4}><Statistic title="对比基线" value={p.review.baselineEnergyKwh} suffix="kWh" /></Col>
          </Row>
          <div style={{ marginTop: 10 }}>
            <ExplainBlock title="复盘说明" items={[
              `复盘时段：${p.review.period}（实际功率积分 vs 同工况人工基线模型推演）`,
              `执行设备：${p.receipts?.map(r => r.deviceId).join('、') ?? '—'}，全部回执成功`,
              `可信度：${p.review.credibility}`,
              p.review.replayOnly ? '口径：模拟回放结果' : '口径：实测 + 基线对比（模拟数据演示）',
              '关联：能效与收益页可查看该方案对月度指标的贡献',
            ]} />
          </div>
        </Card>
      ))}

      {/* 指令审计日志 */}
      <SectionTitle extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}><AuditOutlined /> 所有控制动作均写入审计日志，可追溯</span>}>指令审计日志</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={{ pageSize: 8 }}
          dataSource={auditLogs.filter(l => ['调度下发', '执行回执异常', '重新下发', '重新下发完成', '调度下发被安全拦截', '人工处置关闭', '方案批准', '方案驳回', '执行回执超时'].some(k => l.action.includes(k)) || l.action.includes('越权'))}
          columns={[
            { title: '时间', dataIndex: 'time', width: 160, render: v => <span className="mono" style={{ fontSize: 12 }}>{v}</span> },
            { title: '操作人', dataIndex: 'actor', width: 80 },
            { title: '角色', dataIndex: 'role', width: 100, render: r => <Tag>{r}</Tag> },
            { title: '动作', dataIndex: 'action', width: 150 },
            { title: '对象', dataIndex: 'target', width: 190, render: t => <span className="mono" style={{ fontSize: 12 }}>{t}</span> },
            { title: '详情', dataIndex: 'detail', render: d => <span style={{ fontSize: 12.5 }}>{d}</span> },
            { title: '结果', dataIndex: 'result', width: 80, render: r => r === 'success' ? <Tag color="green">成功</Tag> : <Tag color="red">拒绝</Tag> },
          ]}
        />
      </Card>

      {/* 下发确认弹窗 */}
      <Modal
        title="确认下发控制指令（高风险操作）" open={!!dispatchTarget} onCancel={() => setDispatchTarget(null)}
        okText="确认下发" okButtonProps={{ danger: true }}
        onOk={() => dispatchTarget && doDispatch(dispatchTarget)}
      >
        {dispatchTarget && (
          <>
            <Alert
              type="warning" showIcon style={{ marginBottom: 10 }}
              message="演示环境模拟控制"
              description="以下指令为模拟 REST 控制调用（启机/停机/加载率调整/压力设定），与真实 PLC 无关。真实环境中此步将调用安全联锁校验并二次确认。"
            />
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="方案">{dispatchTarget.name}</Descriptions.Item>
              <Descriptions.Item label="影响范围">{dispatchTarget.actions.map(a => a.deviceId).join('、')} 共 {dispatchTarget.actions.length} 台设备</Descriptions.Item>
              <Descriptions.Item label="指令清单">{dispatchTarget.actions.map(a => actionText(a)).join('；')}</Descriptions.Item>
              <Descriptions.Item label="执行人">{me().name}（{useApp.getState().roleOf()}）</Descriptions.Item>
              <Descriptions.Item label="失败预案">任一回执失败/超时 → 方案标记「状态未知」→ 自动创建异常待办 → 人工核实现场后处置</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      {/* 人工处置弹窗 */}
      <Modal
        title={`人工处置：${manualTarget?.name ?? ''}`} open={!!manualTarget} onCancel={() => setManualTarget(null)}
        okText="提交处置" onOk={async () => {
          if (!manualNote.trim()) { message.warning('请填写处置说明'); return }
          if (manualTarget) { await resolveAbnormalPlan(manualTarget.id, 'manual_close', manualNote.trim()); message.success('已按人工处置关闭，方案标记为「执行失败」并归档') }
          setManualTarget(null)
        }}
      >
        <Alert style={{ marginBottom: 10 }} type="info" showIcon
          message="适用场景：现场已核实设备状态、确认无需重新下发，或已改为人工操作完成。" />
        <Input.TextArea rows={3} value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="例如：已到现场确认 AC-04 仍处待机，网关通讯恢复后改由人工在本机完成加载率调整，方案作废。" />
      </Modal>

      {/* 执行日志抽屉式弹窗 */}
      <Modal title={`执行日志：${logTarget?.id ?? ''}`} open={!!logTarget} onCancel={() => setLogTarget(null)} footer={null} width={720}>
        {logTarget && (
          <Timeline
            items={[
              { color: 'blue', children: `方案生成：${dayjs(logTarget.createdAt).format('MM-DD HH:mm:ss')} · ${logTarget.createdBy}` },
              ...(logTarget.approvedAt ? [{ color: 'blue' as const, children: `人工批准：${dayjs(logTarget.approvedAt).format('MM-DD HH:mm:ss')} · ${logTarget.approvedBy}` }] : []),
              ...(logTarget.receipts ?? []).map(r => ({
                color: r.result === 'success' ? 'green' as const : 'red' as const,
                children: `[${dayjs(r.finishedAt).format('HH:mm:ss')}] ${r.deviceId} ${r.command} → ${RESULT_TAG[r.result]?.t}（${(r.latencyMs / 1000).toFixed(1)}s）${r.message}`,
              })),
              { color: 'gray', children: `当前状态：${logTarget.status} · 演示环境模拟控制` },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}
