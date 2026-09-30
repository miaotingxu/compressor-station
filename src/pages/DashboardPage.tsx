import { useState } from 'react'
import { Card, Row, Col, Button, Tag, Empty, Timeline, Statistic, Modal, Input, message, Tooltip, Badge, Space } from 'antd'
import {
  CheckCircleOutlined, RightOutlined, WarningOutlined, ClockCircleOutlined, AimOutlined,
  ThunderboltOutlined, HistoryOutlined, FireOutlined, RobotOutlined, HeartOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { AI_METRICS } from '../data/timeseries'
import { LOAD_FORECAST } from '../data/timeseries'
import { DemoTag, SectionTitle } from '../components/common'
import { ROLE_DEFS } from '../data/initial'
import { COMPRESSORS } from '../data/initial'
import dayjs from 'dayjs'

const KIND_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  plan_approval: { label: '方案审批', icon: <AimOutlined />, color: '#1d4ed8' },
  alert_confirm: { label: '告警处置', icon: <WarningOutlined />, color: '#fa8c16' },
  workorder: { label: '维修工单', icon: <HeartOutlined />, color: '#722ed1' },
  data_quality: { label: '数据质量', icon: <ThunderboltOutlined />, color: '#13c2c2' },
  energy_deviation: { label: '收益偏差', icon: <FireOutlined />, color: '#eb2f96' },
  strategy_release: { label: '策略发布', icon: <RobotOutlined />, color: '#2f54eb' },
  execution_abnormal: { label: '执行异常', icon: <WarningOutlined />, color: '#f5222d' },
}

export default function DashboardPage() {
  const nav = useNavigate()
  const { todos, me, roleOf, currentRole, devices, resolveTodo } = useApp()
  const [showHistory, setShowHistory] = useState(false)
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const open = todos.filter(t => !t.done)
  const done = todos.filter(t => t.done)
  const order = { high: 0, medium: 1, low: 2 }
  open.sort((a, b) => order[a.severity] - order[b.severity])

  const running = devices.filter(d => d.status === 'running' && (d.kind === 'centrifugal' || d.kind === 'screw'))
  const totalPower = Math.round(running.reduce((s, d) => s + d.powerKw, 0))
  const totalFlow = Math.round(running.reduce((s, d) => s + d.flowM3Min, 0))
  const peak = Math.max(...LOAD_FORECAST.map(p => p.forecastM3Min))
  const roleDesc = ROLE_DEFS.find(r => r.key === currentRole)!

  const quickActions = [
    { label: '生成调度方案', icon: <AimOutlined />, path: '/scheduling' },
    { label: '处理告警', icon: <WarningOutlined />, path: '/operation' },
    { label: '设备健康诊断', icon: <HeartOutlined />, path: '/health' },
    { label: '问 Agent', icon: <RobotOutlined />, path: '/assistant' },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="page-title">
            {me().name}，{dayjs().hour() < 12 ? '上午好' : dayjs().hour() < 18 ? '下午好' : '晚上好'}
            <DemoTag />
          </h1>
          <div className="page-subtitle">
            您的角色是「{roleOf()}」：{roleDesc.desc} —— {dayjs().format('YYYY年MM月DD日 dddd HH:mm')}
          </div>
        </div>
        <Space wrap>
          {quickActions.map(q => (
            <Button key={q.label} icon={q.icon} onClick={() => nav(q.path)}>{q.label}</Button>
          ))}
        </Space>
      </div>

      {/* 站点概况 */}
      <Row gutter={12} style={{ marginTop: 4 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="当前总供气流量" value={totalFlow} suffix="m³/min" precision={0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="当前总功率" value={totalPower} suffix="kW" /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="未来 4h 峰值负荷（预测）" value={peak} suffix="m³/min"
              valueStyle={{ color: peak > totalFlow + 20 ? '#fa8c16' : undefined }}
            />
            <div style={{ fontSize: 12, color: peak > totalFlow + 20 ? '#fa8c16' : 'rgba(0,0,0,0.45)' }}>
              {peak > totalFlow + 20 ? '负荷将上升，建议生成调度方案' : '产能可覆盖预测峰值'}
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="系统综合能效提升（AI 期 vs 基线）" value={6.3} suffix="%" precision={1} valueStyle={{ color: '#52c41a' }} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>目标 ≥6% · 比功率 {AI_METRICS.specificEnergy} kWh/m³</div>
          </Card>
        </Col>
      </Row>

      {/* 待办事项 */}
      <SectionTitle extra={
        <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => setShowHistory(s => !s)}>
          {showHistory ? '收起历史' : `历史记录（${done.length}）`}
        </Button>
      }>
        待我处理 <Badge count={open.length} size="small" style={{ marginLeft: 6 }} />
      </SectionTitle>

      {open.length === 0 ? (
        <Card><Empty description="太棒了，当前没有待处理事项。历史处理记录见下方。" /></Card>
      ) : (
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {open.map(t => {
            const meta = KIND_META[t.kind]
            return (
              <Card
                key={t.id} size="small" hoverable
                title={
                  <Space size={8}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <Tag>{meta.label}</Tag>
                    {t.severity === 'high' && <Tag color="red">高优先级</Tag>}
                    {t.severity === 'medium' && <Tag color="gold">中优先级</Tag>}
                  </Space>
                }
                extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}><ClockCircleOutlined /> {dayjs(t.createdAt).format('MM-DD HH:mm')}</span>}
                actions={[
                  <Button type="link" size="small" onClick={() => nav(t.link)}>去处理 <RightOutlined /></Button>,
                  <Button
                    key="done" type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }}
                    onClick={() => { setNoteOpen(t.id); setNoteText('') }}
                  >标记完成</Button>,
                ]}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{t.detail}</div>
              </Card>
            )
          })}
        </div>
      )}

      {showHistory && (
        <Card size="small" style={{ marginTop: 12 }} title={`历史处理记录（${done.length}）`}>
          {done.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史记录" /> : (
            <Timeline
              items={done.map(t => ({
                color: 'green',
                children: (
                  <div>
                    <b style={{ fontSize: 13 }}>{t.title}</b>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
                      {t.resolvedBy ? `${t.resolvedBy} 完成于 ` : '完成于 '}{dayjs(t.resolvedAt).format('MM-DD HH:mm')}
                      {t.resolveNote ? ` · 备注：${t.resolveNote}` : ''}
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      )}

      {/* 在线机组速览 */}
      <SectionTitle>在线机组速览</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {COMPRESSORS.map(d => {
          const dev = devices.find(x => x.id === d.id)!
          return (
            <div key={d.id} style={{ marginBottom: 0 }}>
              <Tooltip title={dev.note}>
                <Card size="small" hoverable onClick={() => nav('/operation')} style={{ borderLeft: `3px solid ${dev.status === 'running' ? '#52c41a' : dev.status === 'standby' ? '#d9d9d9' : '#faad14'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>{dev.id}</b>
                    <Tag color={dev.status === 'running' ? 'green' : dev.status === 'standby' ? 'default' : 'gold'}>
                      {dev.status === 'running' ? '运行' : dev.status === 'standby' ? '待机' : '检修'}
                    </Tag>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)', marginTop: 6 }}>
                    {dev.status === 'running' ? `${dev.loadRate}% · ${dev.flowM3Min} m³/min` : '—'}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                    {dev.status === 'running' ? `${Math.round(dev.powerKw)} kW · 健康 ${dev.healthScore}` : `健康 ${dev.healthScore}`}
                  </div>
                </Card>
              </Tooltip>
            </div>
          )
        })}
      </div>

      <Modal
        title="标记待办完成" open={!!noteOpen} onCancel={() => setNoteOpen(null)}
        onOk={() => {
          if (!noteText.trim()) { message.warning('请填写处理备注，便于历史追溯'); return }
          resolveTodo(noteOpen!, noteText.trim())
          message.success('待办已完成，已转入历史记录')
          setNoteOpen(null)
        }}
        okText="确认完成"
      >
        <Input.TextArea
          rows={3} value={noteText} onChange={e => setNoteText(e.target.value)}
          placeholder="填写处理备注（必填），例如：已通知仪表班检查 DR-01 露点变送器通讯"
        />
      </Modal>
    </div>
  )
}
