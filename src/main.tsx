import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import App from './App'
import './styles/global.css'

dayjs.locale('zh-cn')
import dayjs from 'dayjs'

ReactDOM.createRoot(document.getElementById('root')!).render(
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
