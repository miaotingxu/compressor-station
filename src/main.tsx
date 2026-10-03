import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import './styles/global.css'

dayjs.locale('zh-cn')

/**
 * 启动引导：优先加载可替换的运行时数据集 public/data/realDataset.json，
 * 加载成功则覆盖内置数据（无需重新构建即可替换数据包），失败则回退到内置数据。
 */
async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/realDataset.json`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    ;(globalThis as Record<string, unknown>).__REAL_DATASET__ = await res.json()
  } catch (err) {
    root.render(
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#b91c1c' }}>
        <h2>真实数据集加载失败</h2>
        <p>未能加载 public/data/realDataset.json：{String(err)}</p>
        <p>请确认数据文件存在，或运行 python3 scripts/build_real_dataset.py 重新生成。</p>
      </div>,
    )
    return
  }

  const { default: App } = await import('./App')

  root.render(
    <React.StrictMode>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1d4ed8',
            colorInfo: '#1d4ed8',
            borderRadius: 6,
            fontSize: 13.5,
          },
          components: {
            Layout: { headerBg: '#ffffff', headerHeight: 56, siderBg: '#0f2049' },
            Menu: { darkItemBg: '#0f2049', darkItemSelectedBg: '#1d4ed8', darkItemHoverBg: 'rgba(255,255,255,0.08)' },
            Card: { headerFontSize: 14.5 },
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </React.StrictMode>,
  )
}

bootstrap()
