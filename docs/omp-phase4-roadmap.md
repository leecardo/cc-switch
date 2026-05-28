# OMP Phase 4+ 开发路线图

## 当前状态

Phase 1-3 已完成，CC Switch 支持：

- OMP app 身份和目录设置（`~/.omp/agent`）
- Provider CRUD via `models.yml`
- 默认模型切换 via `config.yml` 的 `modelRoles.default`
- MCP 服务器管理 via `mcp.json`
- Skills 安装/启用/禁用
- Prompts 编辑（`AGENTS.md`）
- 启动时自动导入已有配置

---

## Phase 4：凭证管理（agent.db）

### 目标

让 CC Switch 能读取和管理 OMP 的 API key / OAuth 凭证，避免用户在两个工具之间手动复制密钥。

### OMP 凭证存储

- 位置：`~/.omp/agent/agent.db`（SQLite）
- 表：`auth_credentials`（由 `AuthCredentialStore` 管理）
- 支持：API key、OAuth token、credential 禁用/启用
- 解析顺序：运行时覆盖 → `agent.db` → 环境变量 → `models.yml` 兜底

### 需要做的事

1. 新增 `src-tauri/src/omp_auth.rs`，读取 `agent.db` 的 `auth_credentials` 表
2. 在 provider 编辑界面展示已存储的凭证状态（只读）
3. 支持从 CC Switch 写入 API key 到 `agent.db`
4. OAuth 流程需要额外评估（OMP 的 OAuth 回调机制）

### 风险

- `agent.db` 的 schema 可能随 OMP 版本变化
- OAuth token 刷新逻辑较复杂，第一版建议只支持 API key
- 需要确认 CC Switch 写入 `agent.db` 不会与 OMP 自身的写入产生竞争

### 预估工作量

- API key 只读：2-3 天
- API key 读写：3-5 天
- OAuth 支持：5-10 天（建议推迟）

---

## Phase 5：项目级配置发现

### 目标

支持 OMP 的项目级 `.omp/` 目录配置，让不同项目可以有不同的 OMP 行为。

### OMP 项目级配置

- `<cwd>/.omp/settings.json` — 项目级设置（覆盖用户级）
- `<cwd>/.omp/mcp.json` — 项目级 MCP 服务器
- `<cwd>/.omp/skills/` — 项目级 Skills
- `<cwd>/.omp/AGENTS.md` — 项目级上下文
- `<cwd>/.omp/rules/` — 项目级规则
- `<cwd>/.omp/commands/` — 项目级命令

### 需要做的事

1. 检测当前工作目录的 `.omp/` 是否存在
2. 将项目级配置与用户级配置合并（项目优先）
3. 在 CC Switch 中区分「用户级」和「项目级」配置
4. 工作区切换时自动切换 OMP 配置

### 风险

- OMP 的配置发现机制复杂（`src/config.ts` 的 `getConfigDirs`）
- 项目级配置与 CC Switch 的全局管理理念有冲突
- 需要决定 CC Switch 是否应该编辑项目级配置

### 预估工作量

- 只读发现：3-5 天
- 读写支持：5-8 天
- 工作区切换集成：3-5 天

---

## Phase 6：SYSTEM.md / RULES.md 编辑

### 目标

在 CC Switch 中编辑 OMP 的系统提示词和规则文件。

### 文件说明

- `~/.omp/agent/SYSTEM.md` — 系统级提示词（注入到每次对话）
- `~/.omp/agent/RULES.md` — 行为规则（正则匹配流式输出，触发课程修正）
- 项目级：`.omp/SYSTEM.md`、`.omp/rules/*.md`

### 需要做的事

1. 在 Prompts 面板中增加 SYSTEM.md 和 RULES.md 的编辑入口
2. 或者创建独立的「OMP Rules」面板
3. 支持规则的启用/禁用/排序
4. 预览规则的正则匹配效果

### 风险

- RULES.md 的格式是 OMP 特有的（正则 + 提示词），通用编辑器可能不够
- 可能需要专门的规则编辑 UI

### 预估工作量

- 简单文本编辑：1-2 天
- 规则管理 UI：3-5 天

---

## Phase 7：Session 管理

### 目标

在 CC Switch 中浏览和恢复 OMP 的会话历史。

### OMP 会话存储

- 位置：`~/.omp/agent/sessions/`（SQLite 数据库）
- 支持：会话列表、消息历史、会话恢复

### 需要做的事

1. 读取 OMP session 数据库
2. 在 Session Manager 中展示 OMP 会话
3. 支持会话搜索和恢复

### 风险

- OMP session 数据库 schema 可能随版本变化
- 会话恢复需要启动 OMP 进程，CC Switch 可能无法直接控制

### 预估工作量

- 只读浏览：3-5 天
- 会话恢复：5-8 天

---

## Phase 8：Usage 统计

### 目标

在 CC Switch 中追踪 OMP 的 token 用量和费用。

### 需要做的事

1. 从 OMP 的 model-cache 数据库读取用量数据
2. 或者通过 OMP 的 API/CLI 获取用量
3. 集成到 CC Switch 的 Usage Dashboard

### 风险

- OMP 的用量数据格式可能与 CC Switch 的不兼容
- 需要确认 OMP 是否有用量查询 API

### 预估工作量

- 基础集成：3-5 天
- 完整 Dashboard：5-8 天

---

## Phase 9：Auth Broker / Auth Gateway

### 目标

支持 OMP 的 auth-gateway 和 auth-broker 机制，让 CC Switch 能代理 OMP 的认证流程。

### OMP 认证机制

- `omp auth-gateway` — 本地代理服务器，处理 OAuth 回调和 API key 路由
- `omp auth-broker` — 跨进程凭证共享

### 需要做的事

1. 检测 OMP auth-gateway 是否运行
2. 支持启动/停止 auth-gateway
3. 在 CC Switch 中配置 auth-gateway 参数

### 风险

- 这是高级功能，用户量可能不大
- 实现复杂度高，收益不确定

### 预估工作量

- 基础检测：2-3 天
- 完整集成：8-15 天

---

## 优先级建议

| Phase | 功能 | 优先级 | 理由 |
|-------|------|--------|------|
| 6 | SYSTEM.md / RULES.md | P1 | 用户最常修改的配置，实现简单 |
| 4 | 凭证管理（API key） | P1 | 避免手动复制密钥，提升体验 |
| 5 | 项目级配置发现 | P2 | 多项目用户需要，但实现复杂 |
| 7 | Session 管理 | P2 | 高级用户需要，schema 风险大 |
| 8 | Usage 统计 | P3 | 锦上添花，依赖 OMP 数据格式 |
| 9 | Auth Broker/Gateway | P3 | 高级功能，用户量小 |

## 开发原则

- 每个 Phase 独立分支，独立 PR
- 先做只读支持，再做读写
- 优先支持 API key，OAuth 推后
- 不与 OMP 自身的写入竞争（文件锁、SQLite WAL）
- 配置映射遵循 OMP 原生格式，不引入 CC Switch 特有字段
