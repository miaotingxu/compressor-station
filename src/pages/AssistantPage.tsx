import { useState, useRef, useEffect } from 'react'
import { Card, Button, Input, Tag, Space, message, Alert, Tooltip, Divider, Row, Col } from 'antd'
import { RobotOutlined, ThunderboltOutlined, AimOutlined, FileSearchOutlined, MessageOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { handleUserMessage, SUGGESTED_QUESTIONS } from '../utils/agent'
import { DemoAlertInline, DemoTag, SectionTitle } from '../components/common'
import type { ChatMessage, SchedulePlan } from '../types'
import dayjs from 'dayjs'
import { peakDemand } from '../utils/scheduler'
import { specificPowerAt, flowAt } from '../utils/scheduler'

export default function AssistantPage() {
  const nav = useNavigate()
  const { chat, pushChat, clearChat, plans, me, currentRole } = useApp()
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, thinking])

  const send = (text?: string) => {
    const t = (text ?? input).trim()
    if (!t || thinking) return
    pushChat({ id: `u-${Date.now()}`, role: 'user', content: t, time: dayjs().format('YYYY-MM-DD HH:mm') })
    setInput('')
    setThinking(true)
    setTimeout(() => {
      const answer = handleUserMessage(t, currentRole)
      pushChat(answer)
      setThinking(false)
    }, 900 + Math.random() * 700)
  }

  /** 把 Agent 建议转为待审批方案（不直接执行） */
  const convertToPlan = (msg: ChatMessage) => {
    const cp = msg.structured?.createPlan
    if (!cp) { message.info('该回答没有可直接转换的方案建议'); return }
    const e = cp.actions.reduce((sum, a) => sum + (a.targetLoadRate && (a.action === 'start' || a.action === 'adjust_load') ? flowAt(useApp.getState().devices.find(d => d.id === a.deviceId)!, a.targetLoadRate) * specificPowerAt(useApp.getState().devices.find(d => d.id === a.deviceId)!, a.targetLoadRate) : 0), 0) * 4
    const plan: SchedulePlan = {
      id: `PLAN-${dayjs().format('YYYYMMDD')}-AGT-${String(Math.floor(Math.random() * 90) + 10)}`,
      name: `${dayjs(cp.effectiveFrom).format('MM-DD HH:mm')} 起调度方案（Agent 助手起草）`,
      strategy: cp.strategy, status: 'draft',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      effectiveFrom: cp.effectiveFrom, durationHours: 4,
      actions: cp.actions,
      expectedEnergyKwh: Math.round(e), baselineEnergyKwh: Math.round(e * 1.021),
      expectedSavingsPct: 2.1, expectedPressureQualifyPct: 99.6,
      risks: { surgeRisk: 'low', overloadRisk: 'low', healthRisk: 'low', pressureRiskText: '新启机组爬坡期母管压力短暂回落，建议提前 10 分钟启机' },
      explanation: [
        '本方案由 Agent 助手根据对话意图起草，未经人工编辑',
        `负荷依据：未来 4 小时峰值需求约 ${peakDemand()} m³/min`,
        '按流程：保存为草稿 → 人工确认参数 → 提交审批 → 值班员批准后下发',
      ],
      evidencePeriod: `${dayjs().subtract(30, 'day').format('YYYY-MM-DD')} ~ 今天`,
      createdBy: `Agent 助手（对话起草 · ${me().name}）`,
    }
    useApp.setState(s => ({ plans: [plan, ...s.plans] }))
    message.success('已创建草稿方案，请在下方确认参数后提交审批（AI 不会直接执行）')
    nav('/scheduling')
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Agent 助手<DemoTag text="自然语言问答 · 模拟 NLU" /></h1>
      <div className="page-subtitle">
        支持调度解释、风险查询、能效归因与方案起草。若您提出控制意图，Agent 只会创建「待审批调度方案」，绝不直接执行任何控制指令。
      </div>

      <DemoAlertInline />

      <Row gutter={12}>
        <Col xs={24} md={17}>
          <Card
            size="small"
            title={<Space><RobotOutlined style={{ color: '#1d4ed8' }} /> 对话</Space>}
            extra={<Button size="small" onClick={clearChat}>清空对话</Button>}
            styles={{ body: { padding: 0 } }}
          >
            <div ref={listRef} style={{ height: 'calc(100vh - 350px)', minHeight: 380, overflowY: 'auto', padding: '14px 16px', background: '#fafbfe' }}>
              {chat.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                  <RobotOutlined style={{ fontSize: 42, color: '#1d4ed8', opacity: 0.35 }} />
                  <div style={{ marginTop: 10, color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>您好，我是空压站多机协同调度 Agent。试试下方示例问题，或直接输入您的问题。</div>
                </div>
              )}
              {chat.map(m => m.role === 'user' ? (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <div className="chat-user-card" style={{ fontSize: 13.5 }}>{m.content}</div>
                </div>
              ) : (
                <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <RobotOutlined style={{ color: '#1d4ed8', fontSize: 18, marginTop: 2 }} />
                  <div className="chat-agent-card" style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13.5 }}>结论</div>
                    <div style={{ fontSize: 13, lineHeight: 1.75 }}>{m.structured?.conclusion ?? m.content}</div>
                    {m.structured && (
                      <>
                        <Divider style={{ margin: '10px 0 8px' }} />
                        <StructuredBlock m={m} onNav={nav} onConvert={() => convertToPlan(m)} />
                      </>
                    )}
                    {m.suggested && m.suggested.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: '24px' }}>继续追问：</span>
                        {m.suggested.map(q => <Button key={q} size="small" onClick={() => send(q)} style={{ fontSize: 12 }}>{q}</Button>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div style={{ display: 'flex', gap: 8, color: 'rgba(0,0,0,0.4)' }}>
                  <RobotOutlined style={{ color: '#1d4ed8' }} />
                  <span style={{ fontSize: 13 }}>Agent 正在检索运行数据、诊断报告与调度方案库……</span>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #eef1f6', background: '#fff' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="例如：未来两小时的最优开机组合是什么？为什么建议停掉 AC-03？"
                  value={input} onChange={e => setInput(e.target.value)}
                  onPressEnter={() => send()}
                  disabled={thinking}
                />
                <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => send()} disabled={thinking}>发送</Button>
              </Space.Compact>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={7}>
          <Card size="small" title="示例问题">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <Button key={q} block style={{ textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '7px 12px', fontSize: 12.5 }} icon={<MessageOutlined />} onClick={() => send(q)}>{q}</Button>
              ))}
            </Space>
          </Card>
          <Card size="small" style={{ marginTop: 12 }} title="Agent 能力边界（安全声明）">
            <Alert
              type="info" showIcon style={{ marginBottom: 8 }}
              message="AI 只做推荐，不直接控制"
              description={<span style={{ fontSize: 12.5 }}>对话中涉及控制意图时，Agent 仅创建「待审批调度方案」，由值班员在智能调度页审批后才能到执行中心下发。</span>}
            />
            <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)', lineHeight: 2 }}>
              · 回答包含：结论、依据、数据时间范围、影响设备、风险、下一步动作<br />
              · 依据可追溯至方案 / 诊断 / 工单 / 时序数据<br />
              · 「采纳建议」会创建草稿方案并引导您完成审批流程
            </div>
          </Card>
          <Card size="small" style={{ marginTop: 12 }} title="意图理解评测（模拟回放）">
            <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.6)' }}>
              评测集 V2：186 条现场常用问句 · 理解准确率 <b style={{ color: '#52c41a' }}>93.4%</b>（目标 ≥90%）<br />
              覆盖意图：调度查询/生成、解释类、风险类、能效归因、待办查询
            </div>
          </Card>
        </Col>
      </Row>

      <SectionTitle>当前待审批方案（含 Agent 起草）</SectionTitle>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {plans.filter(p => p.status === 'pending_approval' || p.status === 'draft').map(p => (
          <Card key={p.id} size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <b style={{ fontSize: 13 }}>{p.name}</b>
                <Tag color={p.status === 'draft' ? 'default' : 'gold'}>{p.status === 'draft' ? '草稿（Agent 起草）' : '待审批'}</Tag>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>生成：{p.createdBy}</span>
              </Space>
              <Button size="small" type="link" onClick={() => nav('/scheduling')}>去处理 →</Button>
            </div>
          </Card>
        ))}
        {plans.filter(p => p.status === 'pending_approval' || p.status === 'draft').length === 0 && (
          <Card size="small"><span style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>暂无待审批方案</span></Card>
        )}
      </Space>
    </div>
  )
}

function StructuredBlock({ m, onNav, onConvert }: { m: ChatMessage; onNav: (p: string) => void; onConvert: () => void }) {
  const s = m.structured!
  return (
    <div style={{ fontSize: 12.5 }}>
      {s.evidence.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>依据</div>
          <ul className="evidence-list" style={{ margin: 0 }}>{s.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )}
      <div style={{ marginTop: 6 }}><b>数据时间范围：</b><span style={{ color: 'rgba(0,0,0,0.6)' }}>{s.dataPeriod}</span></div>
      {s.devices.length > 0 && <div style={{ marginTop: 4 }}><b>影响设备：</b>{s.devices.map(d => <Tag key={d} style={{ fontSize: 11 }} className="mono">{d}</Tag>)}</div>}
      {s.risks.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '6px 0 2px' }}>风险</div>
          {s.risks.map((r, i) => <div key={i} style={{ color: '#d4380d' }}>· {r}</div>)}
        </>
      )}
      {s.nextActions.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '6px 0 2px' }}>推荐下一步动作</div>
          {s.nextActions.map((r, i) => <div key={i} style={{ color: 'rgba(0,0,0,0.7)' }}>· {r}</div>)}
        </>
      )}
      <Space size={6} wrap style={{ marginTop: 10 }}>
        {s.createPlan ? (
          <Tooltip title="将建议转为草稿方案，进入审批流程">
            <Button size="small" type="primary" icon={<AimOutlined />} onClick={onConvert}>转为待审批方案</Button>
          </Tooltip>
        ) : (
          <Button size="small" icon={<CheckOutlined />} onClick={() => onNav('/scheduling')}>采纳建议</Button>
        )}
        <Button size="small" icon={<FileSearchOutlined />} onClick={() => onNav(s.devices.includes('AC-01') && s.risks.some(r => r.includes('喘振')) ? '/health' : s.evidence.some(e => e.includes('工单')) ? '/health' : '/operation')}>查看依据</Button>
        <Button size="small" onClick={() => onNav('/scheduling')}>继续追问</Button>
      </Space>
    </div>
  )
}
