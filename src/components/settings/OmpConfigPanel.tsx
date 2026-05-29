import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ompConfigApi, type OmpConfig } from "@/lib/api/omp";

const THINKING_LEVELS = [
  "inherit",
  "off",
  "min",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

const DEFAULT_THINKING_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

/** 已知 role 的默认标签 */
const KNOWN_ROLE_LABELS: Record<string, string> = {
  default: "Default",
  smol: "Fast",
  slow: "Thinking",
  vision: "Vision",
  plan: "Architect",
  designer: "Designer",
  commit: "Commit",
  task: "Subtask",
};

function getRoleLabel(key: string): string {
  return KNOWN_ROLE_LABELS[key] ?? key;
}

/**
 * 解析 "provider/model:thinking" 为 { model, thinking }
 * 无 thinking 后缀时 thinking = "inherit"
 */
function parseModelValue(value: string): {
  model: string;
  thinking: string;
} {
  const idx = value.lastIndexOf(":");
  if (idx > 0) {
    const model = value.substring(0, idx);
    const thinking = value.substring(idx + 1);
    if (THINKING_LEVELS.includes(thinking as any)) {
      return { model, thinking };
    }
  }
  return { model: value, thinking: "inherit" };
}

function buildModelValue(model: string, thinking: string): string {
  if (!model) return "";
  if (thinking === "inherit") return model;
  return `${model}:${thinking}`;
}

function OmpRoleKeyInput({
  roleKey,
  onRename,
}: {
  roleKey: string;
  onRename: (oldKey: string, newKey: string) => void;
}) {
  const [draft, setDraft] = useState(roleKey);

  useEffect(() => {
    setDraft(roleKey);
  }, [roleKey]);

  const commitRename = useCallback(() => {
    onRename(roleKey, draft);
  }, [draft, onRename, roleKey]);

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitRename();
          e.currentTarget.blur();
        }
      }}
      className="w-28 font-mono text-sm shrink-0"
      title={getRoleLabel(roleKey)}
    />
  );
}

export function OmpConfigPanel({
  providers,
}: {
  providers?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<OmpConfig>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [newRoleKey, setNewRoleKey] = useState("");

  // 初始加载 config
  useEffect(() => {
    ompConfigApi
      .getConfig()
      .then((c) => setConfig(c))
      .catch((e) => {
        console.error("[OmpConfigPanel] Failed to load config", e);
        toast.error(t("omp.config.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  // providers 变更时刷新模型列表
  useEffect(() => {
    ompConfigApi
      .getAvailableModels()
      .then(setAvailableModels)
      .catch((e) =>
        console.error("[OmpConfigPanel] Failed to refresh models", e),
      );
  }, [providers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await ompConfigApi.updateConfig(config);
      toast.success(t("omp.config.saved"));
    } catch (e) {
      console.error("[OmpConfigPanel] Failed to save config", e);
      toast.error(t("omp.config.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [config, t]);

  const setModelRole = useCallback((role: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      modelRoles: { ...prev.modelRoles, [role]: value },
    }));
  }, []);

  const removeModelRole = useCallback((role: string) => {
    setConfig((prev) => {
      const { [role]: _, ...rest } = prev.modelRoles ?? {};
      return { ...prev, modelRoles: rest };
    });
  }, []);

  const normalizeRoleKey = useCallback(
    (key: string) => key.trim().toLowerCase().replace(/\s+/g, "-"),
    [],
  );

  const renameModelRole = useCallback(
    (oldKey: string, rawNewKey: string) => {
      const newKey = normalizeRoleKey(rawNewKey);
      if (!newKey || oldKey === newKey) return;

      setConfig((prev) => {
        const roles = { ...prev.modelRoles };
        if (roles[newKey] !== undefined) {
          return prev;
        }
        const value = roles[oldKey];
        delete roles[oldKey];
        roles[newKey] = value;
        return { ...prev, modelRoles: roles };
      });
    },
    [normalizeRoleKey],
  );

  const addModelRole = useCallback(() => {
    const key = normalizeRoleKey(newRoleKey);
    if (!key || config.modelRoles?.[key] !== undefined) return;
    setConfig((prev) => ({
      ...prev,
      modelRoles: { ...prev.modelRoles, [key]: "" },
    }));
    setNewRoleKey("");
  }, [newRoleKey, config.modelRoles, normalizeRoleKey]);

  const roleEntries = Object.entries(config.modelRoles ?? {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{t("omp.config.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("omp.config.description")}
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {t("omp.config.save")}
        </Button>
      </div>

      {/* Model Roles - dynamic list */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t("omp.config.modelRoles.title")}
        </Label>

        <div className="grid gap-2">
          {roleEntries.map(([key, value]) => {
            const { model, thinking } = parseModelValue(value ?? "");
            return (
              <div key={key} className="flex items-center gap-2">
                {/* Role key (editable) */}
                <OmpRoleKeyInput roleKey={key} onRename={renameModelRole} />
                {/* Model selector */}
                <Select
                  value={model}
                  onValueChange={(m) =>
                    setModelRole(key, buildModelValue(m, thinking))
                  }
                >
                  <SelectTrigger className="flex-1 font-mono text-sm">
                    <SelectValue
                      placeholder={t("omp.config.modelRoles.selectModel")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                    {/* 保留当前值即使不在 availableModels 中 */}
                    {model && !availableModels.includes(model) && (
                      <SelectItem value={model}>{model}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {/* Thinking level selector */}
                <Select
                  value={thinking}
                  onValueChange={(th) =>
                    setModelRole(key, buildModelValue(model, th))
                  }
                >
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THINKING_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Delete */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeModelRole(key)}
                  title={t("omp.config.modelRoles.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add new role */}
        <div className="flex items-center gap-2">
          <Input
            value={newRoleKey}
            onChange={(e) => setNewRoleKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addModelRole()}
            placeholder={t("omp.config.modelRoles.newKeyPlaceholder")}
            className="w-28 font-mono text-sm shrink-0"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addModelRole}
            disabled={!newRoleKey.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("omp.config.modelRoles.add")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("omp.config.modelRoles.hint")}
        </p>
      </div>

      {/* Default Thinking Level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {t("omp.config.thinkingLevel")}
        </Label>
        <Select
          value={config.defaultThinkingLevel ?? "xhigh"}
          onValueChange={(v) =>
            setConfig((prev) => ({ ...prev, defaultThinkingLevel: v }))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_THINKING_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Display */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">
            {t("omp.config.showTokenUsage")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("omp.config.showTokenUsageHint")}
          </p>
        </div>
        <Switch
          checked={config.display?.showTokenUsage ?? false}
          onCheckedChange={(checked) =>
            setConfig((prev) => ({
              ...prev,
              display: { ...prev.display, showTokenUsage: checked },
            }))
          }
        />
      </div>
    </div>
  );
}
