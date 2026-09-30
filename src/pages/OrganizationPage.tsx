import { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Space, Modal, message, Descriptions, Alert, Avatar, Badge, Switch, Tooltip, Input } from 'antd'
import {
  TeamOutlined, SafetyOutlined, AuditOutlined, ApiOutlined, CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import { useApp } from '../store/appStore'
import { DemoAlertInline, SectionTitle, DemoTag } from '../components/common'
import { ROLE_DEFS, MEMBERS, SITE } from '../data/initial'
import type { RoleKey } from '../types'
import dayjs from 'dayjs'

const PERMS = [
  { key: 'view:all', label: '查看全部业务数据', roles: ['operator', 'energy_manager', 'device_engineer', 'admin'] },
  { key: 'alert:handle', label: '告警确认/处置', roles: ['operator', 'device_engineer'] },
  { key: 'plan:approve', label: '调度方案审批/驳回', roles: ['operator'] },
  { key: 'plan:dispatch', label: '控制指令下发', roles: ['operator'] },
  { key: 'workorder:manage', label: '工单创建/指派/开工', roles: ['device_engineer'] },
  { key: 'workorder:close', label: '工单复测/验收关闭', roles: ['device_engineer'] },
  { key: 'report:export', label: '能效报告导出', roles: ['operator', 'energy_manager', 'admin'] },
  { key: 'config:manage', label: '设备档案/阈值/数据源配置', roles: ['admin'] },
  { key: 'strategy:manage', label: '策略版本发布/回滚', roles: ['admin'] },
  { key: 'member:manage', label: '成员与角色管理', roles: ['admin'] },
  { key: 'audit:view', label: '审计日志查看', roles: ['admin'] },
]

const CONTROL_APIS = [
  { name: '机组启停控制', endpoint: 'POST /api/v1/control/device/start-stop', status: 'healthy', latency: '182ms', note: '演示环境模拟控制' },
  { name: '加载率调整', endpoint: 'POST /api/v1/control/device/load-rate', status: 'healthy', latency: '156ms', note: '演示环境模拟控制' },
  { name: '压力设定值', endpoint: 'POST /api/v1/control/header/setpoint', status: 'healthy', latency: '161ms', note: '演示环境模拟控制' },
  { name: 'AC-04 控制网关', endpoint: 'modbus://192.168.10.24:502', status: 'degraded', latency: '偶发 >10s', note: '固件老旧，建议升级；触发过回执超时（PLAN-20260920-002）' },
  { name: '回执确认服务', endpoint: 'GET /api/v1/control/receipts/:id', status: 'healthy', latency: '98ms', note: '超时判定 10s' },
]

export default function OrganizationPage() {
  const { auditLogs, currentRole, me } = useApp()
  const [logSearch, setLogSearch] = useState('')
  const deniedLogs = auditLogs.filter(l => l.result === 'denied')

  const logs = auditLogs.filter(l =>
    !logSearch || (l.action + l.target + l.actor + l.detail).includes(logSearch),
  )

  const tryDispatch = () => {
    // 越权演示：任何非 operator 角色点击都会被记录
    message.error('权限拒绝：控制指令下发仅限「值班员」角色。该越权尝试已写入审计日志。')
    useApp.getState().addAudit('控制指令下发（越权尝试）', 'AC-01', `${useApp.getState().roleOf()} ${me().name} 在组织页尝试直接下发控制指令，系统拒绝`, 'denied')
  }

  return (
    <div className="page-container">
      <h1 className="page-title">组织与审计<DemoTag /></h1>
      <div className="page-subtitle">成员管理、角色权限、审批流、控制接口健康状态与操作日志。所有关键动作可追溯。</div>

      <DemoAlertInline />

      {/* 成员 */}
      <SectionTitle extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>演示环境可直接在顶部切换角色体验权限差异</span>}>成员管理</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={MEMBERS}
          columns={[
            { title: '成员', dataIndex: 'name', width: 130, render: (v, r) => <Space size={8}><Avatar size={26} style={{ background: r.role === 'admin' ? '#722ed1' : r.role === 'operator' ? '#1d4ed8' : r.role === 'device_engineer' ? '#13c2c2' : '#52c41a', fontSize: 12 }}>{v[0]}</Avatar><div><b style={{ fontSize: 13 }}>{v}</b><div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.account}</div></div></Space> },
            { title: '角色', dataIndex: 'role', width: 130, render: (r: RoleKey) => <Tag color={r === 'admin' ? 'purple' : r === 'operator' ? 'blue' : r === 'device_engineer' ? 'cyan' : 'green'}>{ROLE_DEFS.find(x => x.key === r)?.name}</Tag> },
            { title: '站点权限', dataIndex: 'sites', width: 140, render: (s: string[]) => s.map((x: string) => <Tag key={x} className="mono">{x}</Tag>) },
            { title: '联系电话', dataIndex: 'phone', width: 130, className: 'mono' },
            { title: '状态', dataIndex: 'active', width: 80, render: a => <Badge status={a ? 'success' : 'default'} text={a ? '启用' : '停用'} /> },
            { title: '备注', render: (_, r) => r.role === 'operator' ? '可审批与下发控制指令' : r.role === 'energy_manager' ? '只读 + 报告导出' : r.role === 'device_engineer' ? '工单全流程' : '系统配置与审计' },
          ]}
        />
      </Card>

      <Row gutter={12} style={{ marginTop: 12 }}>
        {/* 权限矩阵 */}
        <Col xs={24} lg={13}>
          <SectionTitle>角色权限矩阵</SectionTitle>
          <Card size="small">
            <Table
              size="small" rowKey="key" pagination={false}
              dataSource={PERMS}
              columns={[
                { title: '权限', dataIndex: 'label', render: v => <span style={{ fontSize: 12.5 }}>{v}</span> },
                ...ROLE_DEFS.map((r: (typeof ROLE_DEFS)[number]) => ({
                  title: r.name, width: 90, align: 'center' as const,
                  render: (_: unknown, row: (typeof PERMS)[number]) => row.roles.includes(r.key)
                    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    : <StopOutlined style={{ color: 'rgba(0,0,0,0.2)' }} />,
                })),
              ]}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
              审批流：AI 生成方案 → 值班员审批（可编辑/驳回）→ 值班员下发 → 系统逐设备回执 → 异常人工处置 → 效果复盘。策略发布需系统管理员审批。
            </div>
          </Card>
        </Col>

        {/* 控制接口 */}
        <Col xs={24} lg={11}>
          <SectionTitle>控制接口健康状态</SectionTitle>
          <Card size="small">
            <Table
              size="small" rowKey="name" pagination={false}
              dataSource={CONTROL_APIS}
              columns={[
                { title: '接口', dataIndex: 'name', render: (v, r) => <div><div style={{ fontSize: 12.5 }}>{v}</div><div className="mono" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.endpoint}</div></div> },
                { title: '状态', width: 80, render: (_, r) => <Tag color={r.status === 'healthy' ? 'green' : r.status === 'degraded' ? 'gold' : 'red'}>{r.status === 'healthy' ? '健康' : r.status === 'degraded' ? '降级' : '故障'}</Tag> },
                { title: '延迟', dataIndex: 'latency', width: 90, render: v => <span className="mono" style={{ fontSize: 12 }}>{v}</span> },
                { title: '备注', dataIndex: 'note', render: v => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{v}</span> },
              ]}
            />
            <Alert
              style={{ marginTop: 10 }} type="warning" showIcon icon={<SafetyOutlined />}
              message="权限验证演示"
              description={<span style={{ fontSize: 12.5 }}>控制指令下发仅限「值班员」。当前角色为「{useApp.getState().roleOf()}」，点击下方按钮体验越权拦截（将写入审计日志）。</span>}
              action={<Button size="small" danger disabled={currentRole === 'operator'} onClick={tryDispatch}>模拟越权下发</Button>}
            />
          </Card>
        </Col>
      </Row>

      {/* 审计日志 */}
      <SectionTitle extra={
        <Space>
          {deniedLogs.length > 0 && <Tag color="red">{deniedLogs.length} 条越权/拒绝记录</Tag>}
          <Input.Search size="small" placeholder="搜索动作/对象/操作人" style={{ width: 220 }} onSearch={setLogSearch} onChange={e => { if (!e.target.value) setLogSearch('') }} allowClear />
        </Space>
      }>
        操作日志（审计）
      </SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={{ pageSize: 10 }}
          dataSource={logs}
          columns={[
            { title: '时间', dataIndex: 'time', width: 160, render: v => <span className="mono" style={{ fontSize: 12 }}>{v}</span> },
            { title: '操作人', dataIndex: 'actor', width: 90 },
            { title: '角色', dataIndex: 'role', width: 110, render: r => <Tag>{r}</Tag> },
            { title: '动作', dataIndex: 'action', width: 170 },
            { title: '对象', dataIndex: 'target', width: 180, render: t => <span className="mono" style={{ fontSize: 12 }}>{t}</span> },
            { title: '详情', dataIndex: 'detail', render: d => <span style={{ fontSize: 12.5 }}>{d}</span> },
            { title: '结果', dataIndex: 'result', width: 80, render: r => r === 'success' ? <Tag color="green">成功</Tag> : <Tag color="red">拒绝</Tag> },
          ]}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
          覆盖动作：数据修改、告警关闭、方案编辑/审批、指令下发、回执、工单关闭、策略发布与回滚、越权拒绝。日志保留 400 条滚动（演示环境）。
        </div>
      </Card>
    </div>
  )
}
