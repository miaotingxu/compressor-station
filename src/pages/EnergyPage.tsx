import { useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, Segmented, Table, Button, Tag, Modal, Descriptions, message, Alert, Tooltip, Empty, Space } from 'antd'
import {
  FundOutlined, DownloadOutlined, FileTextOutlined, ArrowUpOutlined, ArrowDownOutlined,
  QuestionCircleOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import { useApp } from '../store/appStore'
import { Chart, AXIS_TIME, AXIS_VAL, LEGEND } from '../components/Chart'
import { DemoAlertInline, SectionTitle, DemoTag, ExplainBlock } from '../components/common'
import { ENERGY_DAILY, BASELINE_METRICS, AI_METRICS, AI_START } from '../data/timeseries'
import { metricDefs } from '../utils/metrics'
import { MONTHLY_REPORT } from '../data/initial'
import type { EnergyRecord } from '../types'
import dayjs from 'dayjs'

type Range = 'day' | 'week' | 'month'

export default function EnergyPage() {
  const { todos, resolveTodo, currentRole } = useApp()
  const [range, setRange] = useState<Range>('month')
  const [detail, setDetail] = useState<{ title: string; rows: [string, string][] } | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const canExport = currentRole === 'energy_manager' || currentRole === 'admin' || currentRole === 'operator'
  const data = useMemo(() => {
    if (range === 'day') return ENERGY_DAILY.slice(-1)
    if (range === 'week') return ENERGY_DAILY.slice(-7)
    return ENERGY_DAILY
  }, [range])

  const aiData = data.filter(d => d.mode === 'ai')
  const baseData = data.filter(d => d.mode === 'baseline')
  const aiSE = aiData.length ? +(aiData.reduce((s, d) => s + d.specificEnergy, 0) / aiData.length).toFixed(4) : 0
  const baseSE = baseData.length ? +(baseData.reduce((s, d) => s + d.specificEnergy, 0) / baseData.length).toFixed(4) : BASELINE_METRICS.specificEnergy
  const improve = baseSE ? +(((baseSE - (aiSE || baseSE)) / baseSE) * 100).toFixed(1) : 0
  const savingKwh = Math.round((baseSE - aiSE) * aiData.reduce((s, d) => s + d.airflowKm3, 0) * 1000)

  const seChart = {
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...AXIS_TIME },
    yAxis: { type: 'value' as const, name: 'kWh/m³', min: 0.06, max: 0.12, ...AXIS_VAL },
    legend: LEGEND,
    series: [
      {
        name: 'AI 调度期', type: 'line' as const, smooth: true, showSymbol: range !== 'month',
        data: data.map(d => (d.mode === 'ai' ? d.specificEnergy : null)),
        connectNulls: true, itemStyle: { color: '#52c41a' }, areaStyle: { opacity: 0.1, color: '#52c41a' },
      },
      {
        name: '人工基线期', type: 'line' as const, smooth: true, showSymbol: range !== 'month',
        data: data.map(d => (d.mode === 'baseline' ? d.specificEnergy : null)),
        connectNulls: true, itemStyle: { color: '#fa8c16' },
      },
      {
        name: '基线均值', type: 'line' as const, data: data.map(() => BASELINE_METRICS.specificEnergy),
        symbol: 'none', lineStyle: { type: 'dashed', color: '#fa8c16', opacity: 0.6 }, itemStyle: { color: '#fa8c16' },
      },
      {
        name: 'AI 均值', type: 'line' as const, data: data.map(() => AI_METRICS.specificEnergy),
        symbol: 'none', lineStyle: { type: 'dashed', color: '#52c41a', opacity: 0.6 }, itemStyle: { color: '#52c41a' },
      },
    ],
    tooltip: { trigger: 'axis', formatter: (ps: unknown) => (ps as { name: string; data: number | null; seriesName: string }[]).filter(p => p.data != null).map(p => `${p.seriesName}<br/>${p.name}：<b>${p.data}</b> kWh/m³`).join('<br/>') },
  }

  const qualifyChart = {
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...AXIS_TIME },
    yAxis: { type: 'value' as const, name: '%', min: 85, max: 100, ...AXIS_VAL },
    legend: LEGEND,
    series: [
      { name: '压力合格率', type: 'bar' as const, data: data.map(d => d.pressureQualifyPct), itemStyle: { color: '#1d4ed8', borderRadius: [3, 3, 0, 0] }, markLine: { silent: true, symbol: 'none', lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: '目标 99.5%', fontSize: 10 }, data: [{ yAxis: 99.5 }] } },
    ],
  }

  const lowLoadChart = {
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...AXIS_TIME },
    yAxis: { type: 'value' as const, name: 'h/日', ...AXIS_VAL },
    legend: LEGEND,
    series: [
      { name: '"大马拉小车"时长', type: 'bar' as const, data: data.map(d => d.lowLoadHours), itemStyle: { color: (p: { data: number }) => (p.data > 4 ? '#fa8c16' : '#52c41a'), borderRadius: [3, 3, 0, 0] } },
      { name: '加载率偏离度 %', type: 'line' as const, yAxisIndex: 0, data: data.map(d => d.avgLoadDeviationPct), symbol: 'circle', symbolSize: 4, itemStyle: { color: '#722ed1' } },
    ],
    tooltip: { trigger: 'axis' },
  }

  const defs = metricDefs()

  const showSavingDetail = () => {
    setDetail({
      title: '节能收益明细与计算依据',
      rows: [
        ['数据范围', `真实数据全周期（分界日 ${AI_START.format('YYYY-MM-DD')}，之前为基线期，之后为近期期）`],
        ['对比基线', `基线期实测系统比功率 ${baseSE || BASELINE_METRICS.specificEnergy} kWh/m³（真实数据计算）`],
        ['计算式', `比功率变化 = (近期比功率 − 基线比功率) / 基线比功率；节电量按两期累计产气量折算，电价 0.8 元/kWh`],
        ['关联调度方案', 'PLAN-20260910-001（已执行复盘）；PLAN-20260911-002（执行异常待处置）'],
        ['口径说明', '主办方提供的是连续运行的历史归档，不含 AI 调度干预前后对照，因此此处为真实数据两期对比，不能等同于 AI 节能收益'],
        ['可信度说明', '数据源为真实数据包；B 相电流等字段存在缺失，已在使用中剔除，其余点位参与统计'],
      ],
    })
  }

  return (
    <div className="page-container">
      <h1 className="page-title">能效与收益<DemoTag /></h1>
      <div className="page-subtitle">基于主办方真实数据（2026-03-12 ~ 2026-09-12）。区分「赛题目标值 / 真实计算值 / 基线期」，每一项均可追溯。</div>

      <DemoAlertInline />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Segmented value={range} onChange={v => setRange(v as Range)} options={[{ label: '按日', value: 'day' }, { label: '按周', value: 'week' }, { label: '按月', value: 'month' }]} />
        <Space>
          <Button icon={<QuestionCircleOutlined />} onClick={showSavingDetail}>收益计算依据</Button>
          <Button type="primary" icon={<FileTextOutlined />} disabled={!canExport} onClick={() => setReportOpen(true)}>{canExport ? '生成月度能效报告' : '报告生成（需能源负责人）'}</Button>
          <Button icon={<DownloadOutlined />} disabled={!canExport} onClick={() => { message.success('报告已导出为 PDF（演示环境模拟导出）') }}>导出 PDF</Button>
        </Space>
      </div>

      {aiSE === 0 && range === 'day' && (
        <Alert style={{ marginBottom: 10 }} type="warning" showIcon message="今日尚未进入 AI 调度期窗口，展示基线数据" />
      )}

      <Row gutter={12}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="系统比功率变化（近期 vs 基线）" value={improve} precision={1} suffix="%" valueStyle={{ color: improve <= 0 ? '#52c41a' : '#ff4d4f' }} prefix={improve <= 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />} /><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{range === 'month' ? '全周期' : range === 'week' ? '7 天' : '今日'}口径（真实数据）</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="单位产气能耗（AI 期）" value={aiSE || BASELINE_METRICS.specificEnergy} precision={4} suffix="kWh/m³" /><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>基线 {baseSE || BASELINE_METRICS.specificEnergy}</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="供气压力合格率" value={AI_METRICS.pressureQualifyPct} precision={2} suffix="%" /><div style={{ fontSize: 12, color: AI_METRICS.pressureQualifyPct >= 99.5 ? '#52c41a' : '#ff4d4f' }}>目标 ≥99.5% · 基线 {BASELINE_METRICS.pressureQualifyPct}%</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="加载率偏离度" value={AI_METRICS.loadDeviationPct} precision={1} suffix="%" prefix="±" /><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>目标 ≤±10% · 基线 ±{BASELINE_METRICS.loadDeviationPct}%</div></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="低载运行时长" value={AI_METRICS.lowLoadHours} precision={1} suffix="h/日" /><div style={{ fontSize: 12, color: '#52c41a' }}>基线 {BASELINE_METRICS.lowLoadHours}h/日 · 下降 {Math.round(((BASELINE_METRICS.lowLoadHours - AI_METRICS.lowLoadHours) / BASELINE_METRICS.lowLoadHours) * 100)}%</div></Card></Col>
        <Col xs={12} md={4}>
          <Card size="small">
            <Statistic title={`预计节电（${range === 'month' ? '30 天' : range === 'week' ? '7 天' : '今日'}）`} value={savingKwh} suffix="kWh" valueStyle={{ color: '#52c41a' }} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>≈ ¥{Math.round(savingKwh * 0.8).toLocaleString()}（电价 0.8 元）· <a onClick={showSavingDetail}>计算依据</a></div>
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}><Card size="small" title="系统比功率趋势（绿色 = AI 调度期 / 橙色 = 人工基线期）"><Chart option={seChart} height={260} /></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="供气压力合格率"><Chart option={qualifyChart} height={260} /></Card></Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card size="small" title="“大马拉小车”工况治理（低载时长与加载率偏离）">
            <Chart option={lowLoadChart} height={240} />
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              统计口径：加载率 &lt;50% 且功率 &gt;30% 额定的运行时长。AI 调度上线（{AI_START.format('MM-DD')}）后通过低载识别与机组轮换显著压缩该工况。
            </div>
          </Card>
        </Col>
      </Row>

      {/* 收益偏差待办 */}
      {todos.some(t => t.id === 'TD-010' && !t.done) && (
        <Alert
          style={{ marginTop: 12 }} type="info" showIcon
          message="本月节能收益偏差 -0.8pp（月累计 5.5% vs 目标 6%）"
          description="真实数据前后半程对比显示近期比功率高于基线期，主要受季节温升与冷却负荷上升影响。查看上方计算依据后可确认关闭该待办。"
          action={<Button size="small" onClick={() => { resolveTodo('TD-010', '已查看收益明细与偏差归因，确认知悉'); message.success('待办已确认关闭') }}>确认知悉并关闭</Button>}
        />
      )}

      {/* 赛题指标 */}
      <SectionTitle extra={<span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>可持续计算的指标取自真实数据；其余保留赛题目标口径</span>}>主办方指标达成（赛题目标 vs 当前值 vs 基线）</SectionTitle>
      <Card size="small">
        <Table
          size="small" rowKey="key" pagination={false}
          dataSource={defs}
          columns={[
            { title: '指标', dataIndex: 'name', width: 210, render: (v, r) => <Space size={4}>{v}{r.bonus && <Tag color="purple">加分</Tag>}</Space> },
            { title: '数据依据', dataIndex: 'dataBasis', width: 100, render: (v: string) => v === 'real' ? <Tag color="green">真实数据</Tag> : <Tag color="orange">赛题目标</Tag> },
            { title: '赛题目标', dataIndex: 'target', width: 100 },
            { title: '当前值', dataIndex: 'currentText', width: 160, render: (v, r) => (
              <Space size={4}>
                <span style={{ fontWeight: 600 }}>{v}</span>
                {r.dataBasis === 'real' && (r.reached ? <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: 11 }}>达标</Tag> : <Tag color="red" icon={<CloseCircleOutlined />} style={{ fontSize: 11 }}>未达标</Tag>)}
              </Space>
            ) },
            { title: '历史基线', dataIndex: 'baselineText', render: v => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{v}</span> },
            { title: '数据时段', dataIndex: 'dataRange', width: 180, render: v => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{v}</span> },
            { title: '追溯', dataIndex: 'source', render: v => <Tooltip title={v}><span style={{ fontSize: 12, color: '#1d4ed8' }}>{v.length > 24 ? v.slice(0, 24) + '…' : v}</span></Tooltip> },
          ]}
        />
        <Alert style={{ marginTop: 10 }} type="info" showIcon message="口径说明" description={<span style={{ fontSize: 12.5 }}>标注「真实数据」的指标由主办方真实数据计算；标注「赛题目标」的指标在提供的数据包中没有对应测点，仅保留目标口径展示。</span>} />
      </Card>

      {/* 收益明细弹窗 */}
      <Modal title={detail?.title} open={!!detail} onCancel={() => setDetail(null)} footer={<Button type="primary" onClick={() => setDetail(null)}>知道了</Button>}>
        {detail && <Descriptions column={1} bordered size="small">{detail.rows.map(([k, v]) => <Descriptions.Item key={k} label={<b style={{ fontSize: 12.5 }}>{k}</b>}><span style={{ fontSize: 12.5 }}>{v}</span></Descriptions.Item>)}</Descriptions>}
      </Modal>

      {/* 月报弹窗 */}
      <Modal
        title={`${MONTHLY_REPORT.title}`} open={reportOpen} onCancel={() => setReportOpen(false)}
        width={760} footer={[
          <Button key="x" onClick={() => setReportOpen(false)}>关闭</Button>,
          <Button key="e" type="primary" icon={<DownloadOutlined />} onClick={() => message.success('月度能效报告已导出（演示环境模拟导出）')}>导出报告</Button>,
        ]}
      >
        <Alert style={{ marginBottom: 10 }} type="info" showIcon icon={<ExperimentOutlined />} message={<>本报告基于<b>主办方真实数据</b>生成 · 数据范围：{MONTHLY_REPORT.dataRange}</>} />
        <Table
          size="small" rowKey="name" pagination={false}
          dataSource={MONTHLY_REPORT.metrics}
          columns={[
            { title: '指标', dataIndex: 'name', width: 180 },
            { title: '本期值', dataIndex: 'value', width: 120, render: v => <b style={{ color: '#1d4ed8' }}>{v}</b> },
            { title: '基线/目标', dataIndex: 'baseline', width: 200, render: v => <span style={{ fontSize: 12 }}>{v}</span> },
            { title: '计算依据', dataIndex: 'note', render: v => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{v}</span> },
          ]}
        />
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
          报告编号 {MONTHLY_REPORT.id} · 生成时间 {MONTHLY_REPORT.generatedAt} · 生成人：Agent 报告引擎（可追溯至方案与工单明细）
        </div>
      </Modal>
    </div>
  )
}
