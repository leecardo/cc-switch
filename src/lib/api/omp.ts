import { invoke } from "@tauri-apps/api/core";

export interface OmpConfig {
  modelRoles?: {
    default?: string;
    slow?: string;
    smol?: string;
    plan?: string;
    vision?: string;
  };
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
};
