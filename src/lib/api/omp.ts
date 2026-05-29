import { invoke } from "@tauri-apps/api/core";

export interface OmpConfig {
  modelRoles?: Record<string, string>;
  defaultThinkingLevel?: string;
  display?: {
    showTokenUsage?: boolean;
  };
  lastChangelogVersion?: string;
}

export const ompConfigApi = {
  async getConfig(): Promise<OmpConfig> {
    return await invoke("get_omp_config");
  },

  async updateConfig(config: OmpConfig): Promise<boolean> {
    return await invoke("update_omp_config", { config });
  },

  /** 获取 models.yml 中所有 provider/model 列表 */
  async getAvailableModels(): Promise<string[]> {
    return await invoke("get_omp_available_models");
  },
};
