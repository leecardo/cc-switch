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

const THINKING_LEVELS = ["none", "low", "medium", "high", "xhigh"] as const;

/** 已知 role 的默认标签映射（仅用于显示，不阻止自定义 key） */
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

export function OmpConfigPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<OmpConfig>({});
  const [newRoleKey, setNewRoleKey] = useState("");

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

  const renameModelRole = useCallback((oldKey: string, newKey: string) => {
    if (!newKey.trim() || oldKey === newKey) return;
    setConfig((prev) => {
      const roles = { ...prev.modelRoles };
      const value = roles[oldKey];
      delete roles[oldKey];
      roles[newKey] = value;
      return { ...prev, modelRoles: roles };
    });
  }, []);

  const addModelRole = useCallback(() => {
    const key = newRoleKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (!key || config.modelRoles?.[key] !== undefined) return;
    setConfig((prev) => ({
      ...prev,
      modelRoles: { ...prev.modelRoles, [key]: "" },
    }));
    setNewRoleKey("");
  }, [newRoleKey, config.modelRoles]);

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
          {roleEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              {/* Role key (editable) */}
              <Input
                value={key}
                onChange={(e) => renameModelRole(key, e.target.value)}
                className="w-28 font-mono text-sm shrink-0"
                title={getRoleLabel(key)}
              />
              {/* Model value */}
              <Input
                value={value ?? ""}
                onChange={(e) => setModelRole(key, e.target.value)}
                placeholder="provider/model:thinking"
                className="flex-1 font-mono text-sm"
              />
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
          ))}
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
            {THINKING_LEVELS.map((level) => (
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
