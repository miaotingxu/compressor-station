import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface Props {
  /** 宽松类型：页面内直接写 ECharts 配置对象 */
  option: Record<string, unknown>
  height?: number | string
  onEvents?: Record<string, (params: unknown) => void>
}

export function Chart({ option, height = 280, onEvents }: Props) {
  const opt = useMemo(() => ({
    animation: true,
    grid: { left: 46, right: 18, top: 36, bottom: 30 },
    tooltip: { trigger: 'axis', confine: true },
    ...option,
  }), [option])
  return <ReactECharts option={opt as unknown as EChartsOption} notMerge style={{ height, width: '100%' }} onEvents={onEvents} />
}

export const AXIS_TIME = {
  axisLabel: { color: 'rgba(0,0,0,0.55)', fontSize: 11 },
  axisLine: { lineStyle: { color: 'rgba(0,0,0,0.15)' } },
  splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.07)' } },
}

export const AXIS_VAL = {
  axisLabel: { color: 'rgba(0,0,0,0.55)', fontSize: 11 },
  axisLine: { show: false },
  splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.07)' } },
}

export const LEGEND = { textStyle: { color: 'rgba(0,0,0,0.65)', fontSize: 12 }, itemWidth: 14, itemHeight: 8, top: 4 }
