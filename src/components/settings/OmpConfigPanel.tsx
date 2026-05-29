import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
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

const MODEL_ROLE_KEYS = [
  { key: "default", labelKey: "omp.config.modelRoles.default" },
  { key: "smol", labelKey: "omp.config.modelRoles.smol" },
  { key: "slow", labelKey: "omp.config.modelRoles.slow" },
  { key: "vision", labelKey: "omp.config.modelRoles.vision" },
  { key: "plan", labelKey: "omp.config.modelRoles.plan" },
  { key: "designer", labelKey: "omp.config.modelRoles.designer" },
  { key: "commit", labelKey: "omp.config.modelRoles.commit" },
  { key: "task", labelKey: "omp.config.modelRoles.task" },
] as const;

export function OmpConfigPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<OmpConfig>({});

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

  const setModelRole = useCallback(
    (role: string, value: string) => {
      setConfig((prev) => ({
        ...prev,
        modelRoles: { ...prev.modelRoles, [role]: value },
      }));
    },
    [],
  );

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
          <h3 className="text-base font-semibold">
            {t("omp.config.title")}
          </h3>
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

      {/* Model Roles */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t("omp.config.modelRoles.title")}
        </Label>
        <div className="grid gap-2">
          {MODEL_ROLE_KEYS.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="w-16 text-sm text-muted-foreground shrink-0">
                {t(labelKey)}
              </Label>
              <Input
                value={config.modelRoles?.[key] ?? ""}
                onChange={(e) => setModelRole(key, e.target.value)}
                placeholder="provider/model:thinking"
                className="flex-1 font-mono text-sm"
              />
            </div>
          ))}
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
