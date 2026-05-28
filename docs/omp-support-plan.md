# CC Switch 接入 OMP 支持开发文档

## 1. 目标

在当前 fork `leecardo/cc-switch` 中，为 CC Switch 增加对 oh-my-pi / OMP 的第一版支持。

这一版只解决“用户级配置管理”问题。
目标是让 CC Switch 能像管理 OpenCode、OpenClaw、Hermes 一样，管理 OMP 的常用配置入口，但不追求一步到位覆盖 OMP 全部能力。

## 2. 第一版范围

### 2.1 要做

- 在应用列表中新增 `omp`
- 支持自定义 OMP 配置目录，默认 `~/.omp/agent`
- 读取和写入 OMP provider 配置
- 切换默认 provider/model
- 读取和写入 OMP MCP 配置
- 读取和写入 OMP Skills 目录
- 读取和写入 OMP 的 `AGENTS.md`
- 启动时从现有 OMP live config 导入 providers

### 2.2 暂不做

- `agent.db` 凭证管理
- 项目级 `.omp/*` 发现与覆盖
- `SYSTEM.md`
- `RULES.md`
- OMP session 管理
- OMP usage 统计
- auth-broker / auth-gateway 集成
- OMP 特有的复杂设置页

## 3. OMP 配置映射

第一版按下面的映射实现。

| 能力 | OMP 路径 | 说明 |
|---|---|---|
| Provider 列表 | `~/.omp/agent/models.yml` | 读写 `providers` |
| 默认模型切换 | `~/.omp/agent/config.yml` | 改 `modelRoles.default` |
| MCP | `~/.omp/agent/mcp.json` | 读写 `mcpServers` |
| Skills | `~/.omp/agent/skills/` | 目录同步 |
| Prompt | `~/.omp/agent/AGENTS.md` | 接入现有 Prompts 面板 |
| 凭证 | `~/.omp/agent/agent.db` | 第一版只识别存在，不管理 |

## 4. 设计原则

- 内部 app id 统一使用 `omp`
- UI 文案显示 `OMP` 或 `oh-my-pi`
- 只处理用户级目录 `~/.omp/agent`
- provider 模式按 additive mode 处理
- 切换 provider 时，除了写 `models.yml`，还要同步更新 `config.yml` 的 `modelRoles.default`
- 第一版不碰项目级 `.omp/*`，避免和 OMP 原生发现机制冲突
- 第一版不碰 `agent.db`，避免把 provider 管理和账号体系混在一起

## 5. 改动顺序

### Phase 1. 先加 app 身份和目录覆盖

目标是让系统先认识 `omp` 这个 app，并能在设置页配置目录。

后端文件：

- `src-tauri/src/app_config.rs`
- `src-tauri/src/settings.rs`
- `src-tauri/src/commands/config.rs`
- `src-tauri/src/lib.rs`

前端文件：

- `src/lib/api/types.ts`
- `src/types.ts`
- `src/lib/schemas/settings.ts`
- `src/hooks/useDirectorySettings.ts`
- `src/hooks/useSettings.ts`
- `src/components/settings/DirectorySettings.tsx`
- `src/components/settings/SettingsPage.tsx`
- `src/config/appConfig.tsx`
- `src/components/AppSwitcher.tsx`
- `src/App.tsx`

交付结果：

- 设置页出现 OMP 配置目录
- app switcher 可以显示 OMP
- 本地 settings 可以存 `ompConfigDir`

### Phase 2. 新建 OMP 配置适配层

新增文件：

- `src-tauri/src/omp_config.rs`

建议先实现这些函数：

- `get_omp_dir()`
- `get_omp_models_path()`
- `get_omp_config_path()`
- `get_omp_mcp_path()`
- `get_omp_agents_path()`
- `read_omp_models()`
- `get_providers()`
- `get_provider()`
- `set_provider()`
- `remove_provider()`
- `apply_switch_defaults()`

实现重点：

- `models.yml` 负责 provider 清单
- `config.yml` 负责默认 model role
- `apply_switch_defaults()` 要把当前默认值写到 `modelRoles.default`

### Phase 3. 接 provider live import、sync、switch

核心文件：

- `src-tauri/src/services/provider/live.rs`
- `src-tauri/src/services/provider/mod.rs`
- `src/lib/api/providers.ts`

必要动作：

- 把 `omp` 纳入 additive mode
- 增加 live provider import
- 增加 live provider remove
- 同步数据库 provider 到 `models.yml`
- 切换 provider 时调用 `apply_switch_defaults()`

这一层完成后，OMP 就能进入“可用但未抛光”的状态。

### Phase 4. 接 MCP、Skills、AGENTS.md

新增文件：

- `src-tauri/src/mcp/omp.rs`

修改文件：

- `src-tauri/src/mcp/mod.rs`
- `src-tauri/src/services/skill.rs`
- `src-tauri/src/prompt_files.rs`

目标：

- MCP 面板读写 `~/.omp/agent/mcp.json`
- Skills 面板读写 `~/.omp/agent/skills/`
- Prompts 面板读写 `~/.omp/agent/AGENTS.md`

说明：

- 第一版 Prompts 面板只接 `AGENTS.md`
- `SYSTEM.md`、`RULES.md` 暂不纳入现有 UI

### Phase 5. 前端表单和预设

建议新增：

- `src/config/ompProviderPresets.ts`
- `src/hooks/useOmp.ts`

重点文件：

- `src/components/providers/forms/ProviderForm.tsx`

第一版表单建议走最小字段：

- name
- baseUrl
- apiKey
- api
- models

如果表单成本偏高，可以先做预设加 JSON 高级编辑，不必一开始做完整专用表单。

### Phase 6. 启动导入、文案、回归测试

涉及文件：

- `src-tauri/src/lib.rs`
- `src/i18n/locales/*.json`
- `src-tauri/src/omp_config.rs`
- `src-tauri/src/mcp/omp.rs`
- `src-tauri/src/services/provider/live.rs`

最低测试集：

- `models.yml` provider 读写
- 切换后 `config.yml` 的 `modelRoles.default` 是否更新
- `mcp.json` 读写
- `AGENTS.md` 路径映射
- `skills` 目录映射
- OMP live provider 启动导入

## 6. 第一版验收标准

满足下面几条，就可以认为第一版完成。

- 用户能在应用切换栏看到 OMP
- 用户能设置 OMP 配置目录
- 用户能新增、编辑、删除 OMP provider
- 用户能在 CC Switch 中切换 OMP 默认 provider/model
- 用户能管理 OMP 的 MCP
- 用户能管理 OMP 的 Skills
- 用户能编辑 OMP 的 `AGENTS.md`
- 不会误改 `agent.db`
- 不会扫描或覆盖项目级 `.omp/*`

## 7. 推荐分支策略

推荐保持 fork 的 `main` 尽量接近上游，不直接在 `main` 上堆 OMP 开发。

推荐这样做：

- `main` 只用来同步上游 `farion1231/cc-switch`
- 实际开发放在功能分支，比如 `feat/omp-support-v1`

创建分支命令：

```bash
git checkout -b feat/omp-support-v1
```

## 8. 当前 fork 的 remote 约定

本地仓库建议保持下面这个结构：

- `origin` -> `https://github.com/leecardo/cc-switch.git`
- `upstream` -> `https://github.com/farion1231/cc-switch`

这样以后同步上游会最顺。

## 9. 以后上游 CC Switch 更新时，sync fork 的操作

推荐用命令行同步，流程最稳定。

### 9.1 同步 `main`

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
git push origin main
```

说明：

- `fetch upstream` 抓取上游最新提交
- `merge --ff-only` 只允许快进，不制造额外 merge commit
- `push origin main` 把同步后的 `main` 推回自己的 fork

### 9.2 把最新上游合并到开发分支

如果开发分支是 `feat/omp-support-v1`，继续执行：

```bash
git checkout feat/omp-support-v1
git rebase main
```

如果 rebase 过程中有冲突：

```bash
# 解决冲突后
git add <冲突文件>
git rebase --continue
```

如果不想继续这次 rebase：

```bash
git rebase --abort
```

完成后推回 fork：

```bash
git push --force-with-lease origin feat/omp-support-v1
```

`--force-with-lease` 只建议用于你自己的功能分支，不要对共享分支乱用。

## 10. 如果一开始就在 main 上开发

如果已经把 OMP 改动直接做在 `main`，后面同步上游会更麻烦。

建议尽快把当前工作切到功能分支：

```bash
git checkout -b feat/omp-support-v1
```

然后把 `main` 重置为 fork 的干净主线，再去同步上游。

如果还没有提交改动，可以直接切分支继续做。
如果已经提交在 `main`，再单独整理 commit。

## 11. 推荐提交顺序

建议按下面的顺序拆 commit：

1. `feat: add omp app id and directory settings`
2. `feat: add omp config adapter`
3. `feat: import and sync omp providers`
4. `feat: support omp mcp`
5. `feat: support omp skills and prompts`
6. `feat: add omp provider form and presets`
7. `test: cover omp config flows`
8. `docs: document omp support`

这样以后做 rebase、cherry-pick、回滚都轻松很多。

## 12. 后续第二版再考虑的内容

这些内容不放在第一版里，但可以作为后续版本目标：

- OMP `agent.db` 凭证管理
- 项目级 `.omp` 规则和配置发现
- `SYSTEM.md` / `RULES.md` 编辑
- OMP session 浏览
- OMP usage 统计
- auth-broker / auth-gateway 支持
