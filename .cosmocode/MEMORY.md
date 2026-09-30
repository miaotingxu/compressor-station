# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 项目知识条目
Agent 在任务执行过程中发现的条目遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息

## 条目

[空压站调度 Agent 项目构建与部署]
- Date: 2026-09-30
- Context: Agent 初始化并部署「空压站多机协同智能调度 Agent」项目时发现
- Category: 构建方法
- Instructions:
  - 技术栈：React 18 + TypeScript + Vite 5 + antd 5 + ECharts + Zustand（localStorage 持久化，key 为 airpress-agent-store）
  - 类型检查：npx tsc --noEmit；生产构建：npm run build（先 tsc 后 vite build，产物在 dist/）
  - 部署预览：npm run preview（生产构建产物，端口 5173，host 0.0.0.0，allowedHosts 已配置 .cosmoplat.cn/.com/.net，见 vite.config.ts 的 server 与 preview 两段配置）
  - dev 模式：npm run dev（同端口；生产演示优先用 preview 以规避 dev 热重载内存峰值）
  - 核心业务数字必须与设备性能模型自洽：比功率单位为 kW/(m³/min)（离心机最优 75%~85%，螺杆机 60%~75%），系统比功率 kWh/m³（基线约 0.1127，AI 期约 0.1050）；修改 initial.ts/timeseries.ts 后用 tsx 跑冒烟脚本验证（峰值产能覆盖、压力合格率、能耗推演）
  - 业务状态核销依赖 TodoItem.refId 关联实体（告警/方案批次/工单/策略/数据质量），新增业务动作需同步核销对应待办
