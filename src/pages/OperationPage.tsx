import { useMemo, useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Modal, Input, Select, Space, Statistic, Drawer, Descriptions, Timeline, message, Segmented, Tooltip, DatePicker } from 'antd'
import { WarningOutlined, ThunderboltOutlined, AimOutlined, FileTextOutlined, CheckCircleOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { Chart, AXIS_TIME, AXIS_VAL, LEGEND } from '../components/Chart'
import {
  DemoAlertInline, DeviceStatusTag, AlertLevelTag, AlertStatusTag, RiskTag, HealthBadge, SectionTitle, DemoTag,
} from '../components/common'
import { LOAD_FORECAST } from '../data/timeseries'
import { DIAGNOSES } from '../data/initial'
import { windowInterpolated, windowLive } from '../data/stationTime'
import { STATION, LOAD } from '../data/stationConfig'
import type { Alert, Device, RiskLevel } from '../types'
import dayjs from 'dayjs'

export default function OperationPage() {
  const nav = useNavigate()
  const { devices, alerts, confirmAlert, alertToScheduling, alertToWorkorder, closeAlert, createWorkOrder, currentRole, me, dataTime, setDataTime, live, toggleLive } = useApp()
  const [detail, setDetail] = useState<Device | null>(null)
  const [closeTarget, setCloseTarget] = useState<Alert | null>(null)
  const [closeConclusion, setCloseConclusion] = useState('')
  const [range, setRange] = useState<'6h' | '24h' | '7d'>('6h')

  const compressors = devices.filter(d => d.kind === 'centrifugal' || d.kind === 'screw')
  const aux = devices.filter(d => d.kind !== 'centrifugal' && d.kind !== 'screw')
  const running = compressors.filter(d => d.status === 'running')

  const trendData = useMemo(() => {
    const src = range === '6h'
      ? windowLive(dataTime, 6, 5)
      : windowInterpolated(dataTime, range === '24h' ? 24 : 168, range === '24h' ? 20 : 120)
    return src.map(p => ({
      time: range === '7d' ? dayjs(p.time).format('MM-DD HH:mm') : dayjs(p.time).format('HH:mm'),
      pressureBar: p.headerPressureBar,
      totalFlow: p.totalFlow,
      totalPowerKw: p.totalPowerKw,
      avgLoadRate: Math.round(p.avgLoadRate),
    }))
  }, [range, dataTime])

  const canHandle = currentRole === 'operator' || currentRole === 'device_engineer'

  const pressureOpt = {
    xAxis: { type: 'category' as const, data: trendData.map(p => p.time), ...AXIS_TIME },
    yAxis: { type: 'value' as const, min: 4.5, max: 6.8, ...AXIS_VAL, name: 'bar' },
    legend: LEGEND,
    series: [
      {
        name: '母管压力', type: 'line' as const, data: trendData.map(p => p.pressureBar), smooth: true,
        showSymbol: false, lineStyle: { width: 2, color: '#1d4ed8' }, itemStyle: { color: '#1d4ed8' },
        markArea: {
          itemStyle: { color: 'rgba(82,196,26,0.08)' },
          data: [[{ yAxis: 5.0 }, { yAxis: 6.4 }]],
        },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: '#52c41a', type: 'dashed' },
          label: { formatter: '合格带 5.0~6.4', fontSize: 10 },
          data: [{ yAxis: 5.0 }, { yAxis: 6.4 }],
        },
      },
    ],
  }

  const flowPowerOpt = {
    xAxis: { type: 'category' as const, data: trendData.map(p => p.time), ...AXIS_TIME },
    yAxis: [
      { type: 'value' as const, name: 'm³/min', ...AXIS_VAL },
      { type: 'value' as const, name: 'kW', ...AXIS_VAL, splitLine: { show: false } },
    ],
    legend: LEGEND,
    series: [
      { name: '总流量', type: 'line' as const, data: trendData.map(p => p.totalFlow), smooth: true, showSymbol: false, itemStyle: { color: '#0ea5e9' } },
      { name: '总功率', type: 'line' as const, yAxisIndex: 1, data: trendData.map(p => p.totalPowerKw), smooth: true, showSymbol: false, itemStyle: { color: '#722ed1' } },
    ],
  }

  const loadOpt = {
    xAxis: { type: 'category' as const, data: trendData.map(p => p.time), ...AXIS_TIME },
    yAxis: { type: 'value' as const, max: 100, ...AXIS_VAL, name: '%' },
    legend: LEGEND,
    series: [
      { name: '平均加载率', type: 'line' as const, data: trendData.map(p => p.avgLoadRate), smooth: true, showSymbol: false, areaStyle: { opacity: 0.12 }, itemStyle: { color: '#13c2c2' } },
      { name: `经济区间下限(${LOAD.economicLowPct}%)`, type: 'line' as const, data: trendData.map(() => LOAD.economicLowPct), symbol: 'none', lineStyle: { type: 'dashed', color: '#faad14' }, itemStyle: { color: '#faad14' } },
    ],
  }

  const forecastOpt = {
    xAxis: { type: 'category' as const, data: LOAD_FORECAST.map(p => p.time), ...AXIS_TIME },
    yAxis: { type: 'value' as const, ...AXIS_VAL, name: 'm³/min' },
    legend: LEGEND,
    series: [
      {
        name: '预测负荷', type: 'line' as const, data: LOAD_FORECAST.map(p => p.forecastM3Min), smooth: true,
        areaStyle: { opacity: 0.15, color: '#1d4ed8' }, itemStyle: { color: '#1d4ed8' },
        markPoint: { data: [{ type: 'max', name: '峰值' }] },
      },
      { name: '置信上界', type: 'line' as const, data: LOAD_FORECAST.map(p => p.upper), lineStyle: { type: 'dashed', opacity: 0.5 }, symbol: 'none', itemStyle: { color: '#1d4ed8' } },
      { name: '置信下界', type: 'line' as const, data: LOAD_FORECAST.map(p => p.lower), lineStyle: { type: 'dashed', opacity: 0.5 }, symbol: 'none', itemStyle: { color: '#1d4ed8' }, areaStyle: { opacity: 0.06 } },
    ],
  }

  const totalPower = Math.round(running.reduce((s, d) => s + d.powerKw, 0))
  const totalFlow = +running.reduce((s, d) => s + d.flowM3Min, 0).toFixed(0)
  const avgLoad = Math.round(running.reduce((s, d) => s + d.loadRate, 0) / (running.length || 1))

  const handleToWorkorder = (a: Alert) => {
    const id = createWorkOrder({
      deviceId: a.deviceId, title: `${a.deviceId} ${a.type === 'bearing' ? '轴承' : '设备'}检修工单（来自告警）`,
      description: a.description, priority: a.level === 'critical' ? 'critical' : 'high', source: 'alert', relatedAlertId: a.id,
    })
    alertToWorkorder(a.id, id)
    message.success(`已创建工单 ${id}，可在「设备健康」页跟进`)
  }

  return (
    <div className="page-container">
      <h1 className="page-title">运行管理 · {STATION.name}<DemoTag text="实时数据驱动" /></h1>
      <div className="page-subtitle">站点总览、机组状态、趋势与告警处置。遥测按分钟实时刷新，可暂停或跳转到指定时刻，全站数据随数据时刻同步。</div>

      <DemoAlertInline />

      <Row gutter={12}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="母管压力" value={trendData[trendData.length - 1]?.pressureBar ?? 5.6} precision={2} suffix="bar" /><div style={{ fontSize: 12, color: '#52c41a' }}>合格带 5.0~6.4</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="总流量" value={totalFlow} suffix="m³/min" /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="总功率" value={totalPower} suffix="kW" /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="平均加载率" value={avgLoad} suffix="%" /><div style={{ fontSize: 12, color: avgLoad < LOAD.economicLowPct ? '#fa8c16' : 'rgba(0,0,0,0.45)' }}>          {avgLoad < LOAD.economicLowPct ? `低于经济区间下限 ${LOAD.economicLowPct}%` : '处于经济区间'}</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="在线机组" value={`${running.length}/${compressors.length}`} suffix="台" /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="未确认告警" value={alerts.filter(a => a.status === 'unconfirmed').length} suffix="条" valueStyle={{ color: alerts.some(a => a.status === 'unconfirmed' && a.level === 'critical') ? '#ff4d4f' : undefined }} /></Card></Col>
      </Row>

      {/* 机组状态表 */}
      <SectionTitle>机组状态</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={compressors} onRow={r => ({ onClick: () => setDetail(r), style: { cursor: 'pointer' } })}
          columns={[
            { title: '机组', dataIndex: 'id', width: 90, render: (v, r) => <Space size={4}><b>{v}</b><span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{r.name.slice(2)}</span></Space> },
            { title: '状态', dataIndex: 'status', width: 90, render: (s: Device['status']) => <DeviceStatusTag s={s} /> },
            { title: '加载率', dataIndex: 'loadRate', width: 110, render: (v: number, r) => (
              <Tooltip title={v > 0 && v < 50 ? '低于经济运行区间（"大马拉小车"）' : ''}>
                <span className="mono" style={{ color: v > 0 && v < 50 ? '#fa8c16' : undefined }}>{v > 0 ? `${v}%` : '—'}</span>
                {v > 0 && <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 3 }}><div style={{ width: `${v}%`, height: 4, borderRadius: 2, background: v < 50 ? '#faad14' : '#52c41a' }} /></div>}
              </Tooltip>
            ) },
            { title: '压力', width: 90, render: (_, r) => <span className="mono">{r.status === 'running' ? `${r.pressureBar.toFixed(2)} bar` : '—'}</span> },
            { title: '流量', width: 110, render: (_, r) => <span className="mono">{r.status === 'running' ? `${r.flowM3Min} m³/min` : '—'}</span> },
            { title: '功率', width: 100, render: (_, r) => <span className="mono">{r.status === 'running' ? `${Math.round(r.powerKw)} kW` : '—'}</span> },
            { title: '健康分', dataIndex: 'healthScore', width: 90, render: (v: number) => <HealthBadge score={v} /> },
            { title: '喘振风险', dataIndex: 'surgeRisk', width: 100, render: (r: Device['surgeRisk']) => r === 'none' ? <Tag>不适用</Tag> : <RiskTag r={r} /> },
            { title: '异常', render: (_, r) => {
              const tags = []
              if (r.vibration > 7.1) tags.push(<Tag key="1" color="red">振动偏高</Tag>)
              if (r.exhaustTempC >= 100) tags.push(<Tag key="2" color="gold">排气温度高</Tag>)
              if (r.status !== 'running') tags.push(<Tag key="3" color="gold">停机</Tag>)
              return tags.length ? <Space size={2}>{tags}</Space> : <Tag>正常</Tag>
            } },
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <Space size={8} wrap>
            <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>辅助设备：</span>
            {aux.map(d => (
              <Button key={d.id} size="small" onClick={() => setDetail(d)}>
                {d.id} {d.name} <DeviceStatusTag s={d.status} />
              </Button>
            ))}
          </Space>
        </div>
      </Card>

      {/* 趋势图 */}
      <SectionTitle extra={
        <Space size={8} wrap>
          <DatePicker
            size="small" showTime={{ format: 'HH' }} format="YYYY-MM-DD HH:00" allowClear={false}
            value={dayjs(dataTime)}
            disabledDate={d => d.isBefore(dayjs(STATION.rangeStart).startOf('day')) || d.isAfter(dayjs(STATION.rangeEnd).endOf('day'))}
            onChange={d => d && setDataTime(d.format('YYYY-MM-DD HH:00:00'))}
          />
          <Button size="small" type={live ? 'primary' : 'default'} icon={live ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={toggleLive}>{live ? '暂停实时' : '开启实时'}</Button>
          <Tag color={live ? 'green' : 'default'}>{live ? '实时刷新中' : '已暂停'}</Tag>
          <Segmented size="small" value={range} onChange={v => setRange(v as typeof range)} options={['6h', '24h', '7d']} />
        </Space>
      }>运行趋势 · 时间轴 {dayjs(dataTime).format('MM-DD HH:00')}</SectionTitle>
      <Row gutter={12}>
        <Col xs={24} lg={8}><Card size="small" title="母管压力趋势"><Chart option={pressureOpt} height={240} /></Card></Col>
        <Col xs={24} lg={8}><Card size="small" title="总流量 / 总功率趋势"><Chart option={flowPowerOpt} height={240} /></Card></Col>
        <Col xs={24} lg={8}><Card size="small" title="平均加载率趋势"><Chart option={loadOpt} height={240} /></Card></Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card size="small" title="未来 4 小时负荷预测（基于真实末尾一日同时段形态）">
            <Chart option={forecastOpt} height={240} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
              依据：真实数据末尾一日的分时负荷形态外推。置信区间 ±5%，峰值出现在 {LOAD_FORECAST.reduce((a, b) => (b.forecastM3Min > a.forecastM3Min ? b : a)).time}。
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="事件时间线（基于真实数据）">
            <Timeline
              items={[
                { color: 'red', children: <span><b>5# 二级振动均值约 9.1 mm/s</b>（超 C 区下限） · 建议频谱复测 <Button type="link" size="small" onClick={() => nav('/health')}>查看诊断</Button></span> },
                { color: 'red', children: <span><b>4# 排气温度峰值 115℃</b> · 关联工单 WO-20260911-002 <Button type="link" size="small" onClick={() => nav('/health')}>查看工单</Button></span> },
                { color: 'orange', children: <span><b>4#/5# B 相电流全程为 0</b> · 三相监测不完整</span> },
                { color: 'blue', children: <span><b>方案 PLAN-20260911-002 执行状态未知</b> · 4# 回执超时 <Button type="link" size="small" onClick={() => nav('/execution')}>去处置</Button></span> },
                { color: 'green', children: <span><b>方案 PLAN-20260910-001 执行完成，复盘节能 2.4%</b></span> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 告警 */}
      <SectionTitle extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>告警必须确认后才能处置；关闭需填写处理结论</span>}>告警管理</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={alerts}
          expandable={{
            defaultExpandedRowKeys: alerts.filter(a => a.status === 'unconfirmed').map(a => a.id),
            expandedRowRender: a => (
              <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.65)', lineHeight: 1.7, padding: '4px 8px' }}>{a.description}</div>
            ),
          }}
          columns={[
            { title: '级别', dataIndex: 'level', width: 70, render: l => <AlertLevelTag l={l} /> },
            { title: '设备', dataIndex: 'deviceId', width: 90 },
            { title: '告警内容', dataIndex: 'title', render: (v, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{dayjs(r.raisedAt).format('MM-DD HH:mm')} · {r.id}</div>
              </div>
            ) },
            { title: '状态', dataIndex: 'status', width: 110, render: s => <AlertStatusTag s={s} /> },
            { title: '关联', width: 150, render: (_, r) => (
              <Space size={4} wrap>
                {r.relatedDiagnosisId && <Button type="link" size="small" style={{ padding: 0 }} onClick={() => nav('/health')}>诊断 {r.relatedDiagnosisId.slice(-7)}</Button>}
                {r.relatedWorkOrderId && <Button type="link" size="small" style={{ padding: 0 }} onClick={() => nav('/health')}>工单 {r.relatedWorkOrderId.slice(-7)}</Button>}
              </Space>
            ) },
            { title: '操作', width: 300, render: (_, a) => (
              <Space size={4} wrap>
                {a.status === 'unconfirmed' && (
                  <Tooltip title={canHandle ? '确认告警' : '当前角色无处置权限'}>
                    <Button size="small" type="primary" ghost disabled={!canHandle} onClick={() => { confirmAlert(a.id); message.success('告警已确认') }}>确认</Button>
                  </Tooltip>
                )}
                {(a.status === 'confirmed' || a.status === 'unconfirmed') && (
                  <>
                    <Tooltip title="纳入调度优化建议">
                      <Button size="small" icon={<AimOutlined />} disabled={!canHandle} onClick={() => { alertToScheduling(a.id); message.success('已转调度处置，将纳入下轮方案生成依据') }}>转调度处置</Button>
                    </Tooltip>
                    <Tooltip title="生成维修工单">
                      <Button size="small" icon={<FileTextOutlined />} disabled={!canHandle} onClick={() => handleToWorkorder(a)}>转维修工单</Button>
                    </Tooltip>
                  </>
                )}
                {(a.status === 'confirmed' || a.status === 'dispatched_scheduling' || a.status === 'to_workorder') && (
                  <Tooltip title={canHandle ? '填写处理结论后关闭' : '当前角色无处置权限'}>
                    <Button size="small" icon={<CheckCircleOutlined />} disabled={!canHandle} onClick={() => { setCloseTarget(a); setCloseConclusion('') }}>关闭</Button>
                  </Tooltip>
                )}
                {a.status === 'closed' && <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>结论：{a.conclusion}</span>}
              </Space>
            ) },
          ]}
        />
      </Card>

      {/* 设备详情抽屉 */}
      <Drawer
        title={<Space>{detail?.id} {detail?.name}<DeviceStatusTag s={detail?.status ?? 'standby'} /></Space>}
        width={560} open={!!detail} onClose={() => setDetail(null)}
      >
        {detail && <DeviceDetail d={detail} onNav={nav} />}
      </Drawer>

      {/* 关闭告警弹窗 */}
      <Modal
        title={`关闭告警 ${closeTarget?.id ?? ''}`} open={!!closeTarget} onCancel={() => setCloseTarget(null)}
        okText="确认关闭" onOk={() => {
          if (!closeConclusion.trim()) { message.warning('处理结论为必填项'); return }
          if (closeTarget) closeAlert(closeTarget.id, closeConclusion.trim())
          message.success('告警已关闭，结论已记录并可追溯')
          setCloseTarget(null)
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 12.5, color: 'rgba(0,0,0,0.55)' }}>
          {closeTarget?.title} —— 请填写处理结论（将写入审计日志，处置人：{me().name}）
        </div>
        <Input.TextArea rows={3} value={closeConclusion} onChange={e => setCloseConclusion(e.target.value)} placeholder="例如：已确认为产线批次用气波动，属正常工况，加强错峰排产即可" />
      </Modal>
    </div>
  )
}

function DeviceDetail({ d, onNav }: { d: Device; onNav: (p: string) => void }) {
  const dg = DIAGNOSES.find(x => x.deviceId === d.id)
  return (
    <div>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="型号">{d.brand} {d.model}</Descriptions.Item>
        <Descriptions.Item label="额定">{d.ratedPowerKw} kW / {d.ratedFlowM3Min} m³/min</Descriptions.Item>
        <Descriptions.Item label="累计运行">{d.runningHours.toLocaleString()} h</Descriptions.Item>
        <Descriptions.Item label="投运日期">{d.installedAt}</Descriptions.Item>
        <Descriptions.Item label="上次维护">{dayjs(d.lastMaintenanceAt).format('YYYY-MM-DD')}</Descriptions.Item>
        <Descriptions.Item label="距下次保养">{d.nextMaintenanceDueHours > 0 ? `${d.nextMaintenanceDueHours} h` : '—'}</Descriptions.Item>
        <Descriptions.Item label="健康评分"><HealthBadge score={d.healthScore} /></Descriptions.Item>
        <Descriptions.Item label="喘振风险">{d.surgeRisk === 'none' ? '不适用' : <RiskTag r={d.surgeRisk} />}</Descriptions.Item>
      </Descriptions>
      {d.note && <div style={{ marginTop: 10, padding: '8px 12px', background: '#f7f9fc', borderRadius: 6, fontSize: 12.5, color: 'rgba(0,0,0,0.65)' }}>{d.note}</div>}

      {(d.kind === 'centrifugal' || d.kind === 'screw') && (
        <>
          <SectionTitle>监测量（真实数据统计均值）</SectionTitle>
          <Row gutter={[8, 8]}>
            {[
              { k: '振动速度', v: `${d.vibration} mm/s`, warn: d.vibration > 4.5 },
              { k: '轴承温度', v: `${d.bearingTempC} ℃`, warn: d.bearingTempC > 85 },
              { k: '绕组温度', v: `${d.windingTempC} ℃`, warn: d.windingTempC > 95 },
              { k: '电流', v: `${d.currentA} A`, warn: false },
              { k: '油压', v: `${d.oilPressureBar} bar`, warn: d.oilPressureBar > 0 && d.oilPressureBar < 1.5 },
            ].map(m => (
              <Col span={8} key={m.k}>
                <Card size="small" style={{ textAlign: 'center', borderColor: m.warn ? '#ffa39e' : undefined }}>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>{m.k}</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: m.warn ? '#ff4d4f' : undefined }}>{m.v}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <SectionTitle>性能曲线（比功率-加载率）</SectionTitle>
          <Chart height={220} option={{
            xAxis: { type: 'value' as const, name: '加载率 %', min: 10, max: 100, ...AXIS_VAL },
            yAxis: { type: 'value' as const, name: 'kW/(m³/min)', ...AXIS_VAL },
            tooltip: { trigger: 'axis', formatter: (ps: unknown) => {
              const p = (ps as { name: string; data: number; axisValue: number }[])
              return `加载率 ${p[0]?.axisValue}%：${p[0]?.data} kW/(m³/min)`
            } },
            series: [{
              type: 'line', smooth: true, data: d.curve.map(c => [c.loadRate, c.specificPower]),
              lineStyle: { color: '#1d4ed8', width: 2 }, itemStyle: { color: '#1d4ed8' },
              areaStyle: { opacity: 0.08 },
              markArea: d.kind === 'centrifugal'
                ? { itemStyle: { color: 'rgba(82,196,26,0.1)' }, data: [[{ xAxis: 75 }, { xAxis: 85 }]] }
                : { itemStyle: { color: 'rgba(82,196,26,0.1)' }, data: [[{ xAxis: 60 }, { xAxis: 75 }]] },
            }],
            grid: { left: 56, right: 20, top: 30, bottom: 40 },
          }} />
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>绿色区为经济运行区；离开绿色区将导致比功率上升（能耗升高），离心机低流量侧同时逼近喘振区。</div>
        </>
      )}

      {dg && (
        <div style={{ marginTop: 12 }}>
          <SectionTitle>关联诊断</SectionTitle>
          <Card size="small" style={{ borderColor: dg.riskLevel === 'high' ? '#ffa39e' : '#ffe58f' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <RiskTag r={dg.riskLevel as RiskLevel} />
              <div style={{ fontSize: 12.5 }}>{dg.conclusion}</div>
              <Button size="small" type="link" style={{ padding: 0 }} onClick={() => onNav('/health')}>查看完整诊断与证据 →</Button>
            </Space>
          </Card>
        </div>
      )}
    </div>
  )
}
