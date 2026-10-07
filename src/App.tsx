import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import DashboardPage from './pages/DashboardPage'
import OperationPage from './pages/OperationPage'
import SchedulingPage from './pages/SchedulingPage'
import ExecutionPage from './pages/ExecutionPage'
import HealthPage from './pages/HealthPage'
import EnergyPage from './pages/EnergyPage'
import AssistantPage from './pages/AssistantPage'
import DataStrategyPage from './pages/DataStrategyPage'
import OrganizationPage from './pages/OrganizationPage'
import { useApp } from './store/appStore'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/operation', element: <OperationPage /> },
      { path: '/scheduling', element: <SchedulingPage /> },
      { path: '/execution', element: <ExecutionPage /> },
      { path: '/health', element: <HealthPage /> },
      { path: '/energy', element: <EnergyPage /> },
      { path: '/assistant', element: <AssistantPage /> },
      { path: '/data-strategy', element: <DataStrategyPage /> },
      { path: '/organization', element: <OrganizationPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  const live = useApp(s => s.live)
  const tickLive = useApp(s => s.tickLive)
  useEffect(() => {
    if (!live) return
    // 实时驱动：每 1.5 秒在真实时序上前进 1 分钟并平滑插值
    const t = setInterval(tickLive, 1500)
    return () => clearInterval(t)
  }, [live, tickLive])
  return <RouterProvider router={router} />
}
