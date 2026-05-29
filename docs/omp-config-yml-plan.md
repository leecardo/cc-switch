# OMP config.yml 设置页实现方案

## 1. 背景

OMP 的 `~/.omp/agent/config.yml` 包含模型角色分配、thinking 级别、显示偏好等运行时配置。当前只能手动编辑文件，需要在 CC Switch 的 OMP 设置页中提供可视化编辑。

### 当前 config.yml 结构

```yaml
modelRoles:
  default: xiaomi/mimo-v2.5-pro:high   # 默认模型
  slow: xiaomi/mimo-v2.5-pro:high      # 慢速/高质量模型
  smol: icev/gpt-5.4-mini:medium       # 轻量模型
  plan: xiaomi/mimo-v2.5-pro:high      # 规划模型
  vision: xiaomi/mimo-v2.5             # 视觉模型
lastChangelogVersion: 14.1.2           # OMP 内部版本标记（只读）
display:
  showTokenUsage: true                 # 是否显示 token 用量
defaultThinkingLevel: xhigh            # 默认 thinking 级别
```

### 已有基础设施

| 层 | 文件 | 能力 |
|---|---|---|
| 后端 | `omp_config.rs:169` | `read_config_yaml()` — 读取整个 config.yml |
| 后端 | `omp_config.rs:182` | `write_config_section(key, value)` — 按顶层 key 写入，保留其他段 |
| 后端 | `omp_config.rs:217` | `apply_switch_defaults(provider_id, config)` — 切换供应商时自动更新 `modelRoles.default` |
| 前端 | `providers.ts:200-222` | OMP providers API（import/list/get/remove） |
| 前端 | `SettingsPage.tsx:321` | 已有 `ompConfigDir` 目录设置 |

---

## 2. 设计

### 2.1 数据模型

```typescript
// 前端 TypeScript 类型
interface OmpConfig {
  modelRoles: {
    default?: string;
    slow?: string;
    smol?: string;
    plan?: string;
    vision?: string;
  };
  defaultThinkingLevel?: string;  // "none" | "low" | "medium" | "high" | "xhigh"
  display?: {
    showTokenUsage?: boolean;
  };
  lastChangelogVersion?: string;  // 只读，不暴露编辑
}
```

### 2.2 后端 API（新增 2 个 Tauri command）

| Command | 参数 | 返回 | 说明 |
|---|---|---|---|
| `get_omp_config` | 无 | `OmpConfig` (JSON) | 读取 config.yml，转 JSON 返回 |
| `update_omp_config` | `config: OmpConfig` | `bool` | 写入 config.yml（按段合并，保留未知字段） |

**写入策略**：逐段调用已有的 `write_config_section()`，只更新 `modelRoles`、`display`、`defaultThinkingLevel` 三个段，不动 `lastChangelogVersion` 等 OMP 内部字段。

### 2.3 前端组件

新增 `OmpConfigPanel.tsx`，放在 OMP providers 页面的 ProviderList 下方，用分隔线隔开。

**放置位置**：`App.tsx:990` 的 `</ProviderList>` 之后，`activeApp === "omp"` 时渲染。

**UI 布局**：

```
┌─ OMP 运行时配置 ──────────────────────────────┐
│                                                │
│  模型角色                                       │
│  ┌─────────────┬──────────────────────────┐    │
│  │ 默认模型     │ [xiaomi/mimo-v2.5-pro:high] │ │
│  │ 慢速模型     │ [xiaomi/mimo-v2.5-pro:high] │ │
│  │ 轻量模型     │ [icev/gpt-5.4-mini:medium]  │ │
│  │ 规划模型     │ [xiaomi/mimo-v2.5-pro:high] │ │
│  │ 视觉模型     │ [xiaomi/mimo-v2.5           │ │
│  └─────────────┴──────────────────────────┘    │
│                                                │
│  Thinking 级别                                  │
│  [none ▾] [low] [medium] [high] [xhigh ✓]     │
│                                                │
│  显示                                           │
│  ☑ 显示 token 用量                              │
│                                                │
│                                    [保存]        │
└────────────────────────────────────────────────┘
```

**交互逻辑**：
- 打开页面时 `invoke("get_omp_config")` 加载
- 保存时 `invoke("update_omp_config", { config })` 写入
- `lastChangelogVersion` 不显示（OMP 内部管理）
- 保存成功后 toast 提示

**OMP 模型选择机制**：
- OMP 没有"当前供应商"概念，models.yml 里所有 provider 同时生效
- 实际用哪个模型由 config.yml 的 `modelRoles.default` 决定
- CC Switch 的"切换供应商"和"启用/禁用"按钮对 OMP 无意义，可在 OMP 视图下隐藏
- `provider/mod.rs:1745` 的 `apply_switch_defaults` 对 OMP 多余，后续可移除

---

## 3. 文件变更清单

### 后端（Rust）

| 文件 | 变更 |
|---|---|
| `src-tauri/src/omp_config.rs` | 新增 `get_config_json() -> Result<serde_json::Value>` 和 `update_config(json: serde_json::Value) -> Result<()>` |
| `src-tauri/src/commands/omp.rs` | 新增 `get_omp_config` 和 `update_omp_config` 两个 Tauri command |
| `src-tauri/src/lib.rs` | 注册新 command 到 invoke handler |

### 前端（TypeScript/React）

| 文件 | 变更 |
|---|---|
| `src/lib/api/omp.ts`（新建） | OMP config API：`getConfig()` / `updateConfig()` |
| `src/components/settings/OmpConfigPanel.tsx`（新建） | 设置面板组件 |
| `src/App.tsx` | ProviderList 下方条件渲染 `OmpConfigPanel`（`activeApp === "omp"`） |
| `src/i18n/locales/zh.json` | 新增 OMP 配置相关翻译 key |

---

## 4. 实现步骤
1. **后端**：`omp_config.rs` 新增 `get_config_json()` / `update_config()`
2. **后端**：`commands/omp.rs` 新增 2 个 command
3. **后端**：`lib.rs` 注册 command
4. **前端**：`lib/api/omp.ts` 新建 API 层
5. **前端**：`OmpConfigPanel.tsx` 实现表单
6. **前端**：`App.tsx` 在 ProviderList 下方条件渲染
7. **i18n**：补充翻译

## 5. 设计缺陷与修正

### 5.1 modelRoles 值格式说明

modelRoles 值格式为 `provider/model:thinking_level`，例如 `xiaomi/mimo-v2.5-pro:high`。
- `:high` 是该角色模型专属的 thinking 级别，只对当前角色生效
- `defaultThinkingLevel` 是全局默认 thinking 级别，当模型值未带 `:` 后缀时生效
- 两者独立，互不影响

**UI 处理**：modelRoles 输入框接受完整格式 `provider/model:thinking_level`，`:` 后缀可选。需在输入框旁注明格式。

### 5.2 config.yml 写入无文件锁

`omp_write_lock()` 只保护 `models.yml`，`config.yml` 的 read-modify-write 没有锁保护。如果 OMP 进程和 CC Switch 同时写 config.yml，可能丢失更新。

**修正**：`update_config` command 实现时应复用 `omp_write_lock()` 或新建独立锁保护 config.yml。

### 5.3 放置位置已确定

OmpConfigPanel 放在 OMP providers 页面的 ProviderList 下方（`App.tsx:990`），用分隔线隔开。不在 SettingsPage 里。

### 5.4 write_config_section 全量替换顶层 key

`write_config_section("modelRoles", value)` 会替换整个 `modelRoles` mapping。如果 OMP 运行时动态新增了 modelRoles key（如自定义角色），前端没拿到这个 key，保存时会丢失。

**修正**：`update_config` 实现时应读取现有 config → 合并用户修改的字段 → 写回，而不是用 `write_config_section` 逐段替换。或者前端加载时保留所有未知字段，保存时原样回传。

### 5.5 缺少错误处理设计

以下场景未说明：
- config.yml 不存在 → 应返回空默认值，保存时自动创建（已提到，但需确认 `atomic_write` 会创建父目录）
- YAML 解析失败 → 应返回错误，前端提示"配置文件格式错误，建议手动编辑"
- 文件权限问题 → 应返回 IO 错误

### 5.6 缺少 modelRoles 输入校验

modelRoles 值应符合 `provider/model` 格式。前端输入框应校验：
- 非空
- 包含 `/`（provider 和 model 之间）
- 不含空格

---

## 6. 注意事项

- `write_config_section()` 已实现按段合并，不会覆盖 `lastChangelogVersion` 等未知字段
- `defaultThinkingLevel` 的可选值需要和 OMP 实际支持的值对齐（none/low/medium/high/xhigh）
- config.yml 不存在时应返回空默认值，保存时自动创建
- OMP 无"切换供应商"概念，`apply_switch_defaults` 对 OMP 可移除（`provider/mod.rs:1745`）