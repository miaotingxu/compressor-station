import { useMemo, useState } from 'react'
import { Layout, Menu, Dropdown, Badge, Input, Avatar, Select, Space, Tooltip, Drawer, List, Button, Tag } from 'antd'
import {
  DashboardOutlined, ControlOutlined, AimOutlined, SendOutlined, HeartOutlined, FundOutlined,
  RobotOutlined, DatabaseOutlined, TeamOutlined, SearchOutlined, BellOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, RightOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { ROLE_DEFS, MEMBERS, SITE } from '../data/initial'
import { SUGGESTED_QUESTIONS } from '../utils/agent'

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/operation', icon: <ControlOutlined />, label: '运行管理' },
  { key: '/scheduling', icon: <AimOutlined />, label: '智能调度' },
  { key: '/execution', icon: <SendOutlined />, label: '执行中心' },
  { key: '/health', icon: <HeartOutlined />, label: '设备健康与预测运维' },
  { key: '/energy', icon: <FundOutlined />, label: '能效与收益' },
  { key: '/assistant', icon: <RobotOutlined />, label: 'Agent 助手' },
  { key: '/data-strategy', icon: <DatabaseOutlined />, label: '数据与策略' },
  { key: '/organization', icon: <TeamOutlined />, label: '组织与审计' },
]

/** 全局搜索索引（页面 + 关键实体） */
const SEARCH_INDEX = [
  { label: '工作台 · 待办事项', path: '/' },
  { label: '运行管理 · 实时状态 / 告警', path: '/operation' },
  { label: '智能调度 · 方案生成与审批', path: '/scheduling' },
  { label: '执行中心 · 指令回执 / 异常处置', path: '/execution' },
  { label: '设备健康 · 诊断 / 喘振风险 / 工单', path: '/health' },
  { label: '能效与收益 · 指标 / 月度报告', path: '/energy' },
  { label: 'Agent 助手 · 自然语言问答', path: '/assistant' },
  { label: '数据与策略 · 数据质量 / 策略版本', path: '/data-strategy' },
  { label: '组织与审计 · 成员 / 操作日志', path: '/organization' },
  { label: '方案 PLAN-20260919-001（已执行复盘）', path: '/execution' },
  { label: '方案 PLAN-20260920-002（执行状态未知）', path: '/execution' },
  { label: '工单 WO-20260920-002（AC-02 轴承检修）', path: '/health' },
  { label: '工单 WO-20260921-003（AC-01 滤网）', path: '/health' },
  { label: '诊断 DG-20260921-003（AC-01 喘振裕度）', path: '/health' },
  { label: '告警 AL-20260921-003（AC-01 喘振）', path: '/operation' },
  { label: '策略 V1.3.0 候选版本（待发布）', path: '/data-strategy' },
  { label: '月度能效报告 RPT-202609', path: '/energy' },
]

export function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const { currentRole, switchRole, todos, alerts, me, roleOf } = useApp()

  const openTodos = todos.filter(t => !t.done)
  const unconfirmed = alerts.filter(a => a.status === 'unconfirmed')
  const badgeCount = openTodos.length + unconfirmed.length

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return SEARCH_INDEX.slice(0, 8)
    return SEARCH_INDEX.filter(i => i.label.toLowerCase().includes(searchText.toLowerCase()))
  }, [searchText])

  const roleOptions = ROLE_DEFS.map(r => ({ value: r.key, label: `${r.name}（${MEMBERS.find(m => m.role === r.key)?.name}）` }))

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <div className="demo-banner">
        <Tag color="gold" style={{ marginRight: 4 }}>演示环境</Tag>
        <span>空压站多机协同智能调度 Agent · {SITE.factory} · {SITE.name} —— 所有数据为模拟数据，控制指令为模拟控制，用于完整业务流程演示</span>
      </div>
      <Layout>
        <Layout.Sider theme="dark" collapsible collapsed={collapsed} trigger={null} width={216} style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', color: '#fff' }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>空</div>
            {!collapsed && (
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>空压站智能调度</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Agent Platform · v1.2</div>
              </div>
            )}
          </div>
          <Menu
            theme="dark" mode="inline" selectedKeys={[loc.pathname]}
            items={NAV.map(n => ({ key: n.key, icon: n.icon, label: collapsed ? <Tooltip title={n.label} placement="right">{n.label}</Tooltip> : n.label }))}
            onClick={({ key }) => nav(key)}
          />
          <div style={{ position: 'absolute', bottom: 14, width: '100%', textAlign: 'center' }}>
            <Button type="text" ghost icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(c => !c)} />
          </div>
        </Layout.Sider>

        <Layout style={{ background: '#f0f2f7' }}>
          <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #e5e9f2', boxShadow: '0 1px 4px rgba(15,32,73,0.04)' }}>
            <Space size={12}>
              <Select
                value="AS-01" style={{ width: 210 }} size="small"
                options={[{ value: 'AS-01', label: `${SITE.factory} · ${SITE.name}` }]}
                popupRender={n => (
                  <div style={{ padding: 8 }}>
                    {n}
                    <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12, padding: '4px 8px' }}>演示环境仅接入 1 号空压站，多站点接入为企业版能力</div>
                  </div>
                )}
              />
              <Button size="small" icon={<SearchOutlined />} onClick={() => setSearchOpen(true)} style={{ width: 200, justifyContent: 'flex-start', color: 'rgba(0,0,0,0.4)' }}>
                搜索页面 / 设备 / 方案 / 工单…
              </Button>
            </Space>
            <Space size={16}>
              <Tooltip title={`未确认告警 ${unconfirmed.length} 条 / 待办 ${openTodos.length} 项`}>
                <Badge count={badgeCount} size="small" offset={[0, 2]}>
                  <BellOutlined style={{ fontSize: 17 }} onClick={() => nav('/')} />
                </Badge>
              </Tooltip>
              <Space.Compact>
                <Tag style={{ marginInlineEnd: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: '3px 8px' }}>当前角色</Tag>
                <Select
                  size="small" style={{ width: 200 }} value={currentRole} options={roleOptions}
                  onChange={switchRole}
                  popupRender={n => (
                    <div style={{ padding: 8 }}>
                      {n}
                      <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, padding: '4px 8px', maxWidth: 280 }}>
                        {ROLE_DEFS.find(r => r.key === currentRole)?.desc}
                      </div>
                    </div>
                  )}
                />
              </Space.Compact>
              <Dropdown
                menu={{
                  items: [
                    { key: 'me', disabled: true, label: <div style={{ padding: '2px 0' }}><b>{me().name}</b><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{roleOf()} · {me().account}</div></div> },
                    { type: 'divider' as const },
                    { key: 'org', icon: <TeamOutlined />, label: '组织与权限', onClick: () => nav('/organization') },
                    { key: 'audit', icon: <SearchOutlined />, label: '审计日志', onClick: () => nav('/organization') },
                  ],
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size={28} style={{ background: '#1d4ed8' }} icon={<UserOutlined />} />
                  <span style={{ fontSize: 13 }}>{me().name}</span>
                </Space>
              </Dropdown>
            </Space>
          </Layout.Header>

          <Layout.Content>
            <Outlet />
          </Layout.Content>
        </Layout>
      </Layout>

      <Drawer
        title="全局搜索" open={searchOpen} onClose={() => setSearchOpen(false)} width={420}
        styles={{ body: { paddingTop: 8 } }}
      >
        <Input
          placeholder="输入关键字：页面 / 方案 / 工单 / 设备 / 策略…"
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear autoFocus
        />
        <List
          style={{ marginTop: 12 }}
          dataSource={searchResults}
          renderItem={item => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 4px' }}
              onClick={() => { nav(item.path); setSearchOpen(false) }}
              actions={[<RightOutlined key="go" style={{ color: 'rgba(0,0,0,0.3)' }} />]}
            >
              <span style={{ fontSize: 13 }}>{item.label}</span>
            </List.Item>
          )}
          locale={{ emptyText: '无匹配结果' }}
        />
      </Drawer>

      <FloatingAgent />
    </Layout>
  )
}

/** 全局悬浮 Agent 入口 */
export function FloatingAgent() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  return (
    <>
      <Tooltip title="Agent 助手 · 自然语言问答与调度建议" placement="left">
        <Button
          type="primary" shape="circle" size="large" icon={<RobotOutlined />}
          onClick={() => setOpen(true)}
          style={{ position: 'fixed', right: 22, bottom: 26, width: 50, height: 50, boxShadow: '0 6px 16px rgba(29,78,216,0.4)', zIndex: 900 }}
        />
      </Tooltip>
      <Drawer
        title={<Space><RobotOutlined style={{ color: '#1d4ed8' }} /> Agent 助手</Space>}
        open={open} onClose={() => setOpen(false)} width={430}
        extra={<Button size="small" type="primary" onClick={() => { nav('/assistant'); setOpen(false) }}>打开完整对话</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#f6f9ff', border: '1px solid #dbe7ff', borderRadius: 8, padding: 12, fontSize: 13 }}>
            您好，我是空压站调度 Agent。我可以解释调度依据、分析设备风险、归因能效变化，也能帮您起草待审批的调度方案（我不会直接下发任何控制指令）。
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>试试这样问：</div>
          {SUGGESTED_QUESTIONS.map(q => (
            <Button key={q} size="small" style={{ textAlign: 'left', height: 'auto', padding: '6px 10px', whiteSpace: 'normal' }} onClick={() => { nav('/assistant'); setOpen(false) }}>
              {q}
            </Button>
          ))}
        </div>
      </Drawer>
    </>
  )
}
