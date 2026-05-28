use std::path::PathBuf;

use crate::settings::get_omp_override_dir;

/// 获取 OMP 用户级配置目录。
///
/// 默认路径：`~/.omp/agent`
/// 可通过 settings.omp_config_dir 覆盖。
pub fn get_omp_dir() -> PathBuf {
    if let Some(override_dir) = get_omp_override_dir() {
        return override_dir;
    }

    crate::config::get_home_dir().join(".omp").join("agent")
}

pub fn get_omp_models_path() -> PathBuf {
    get_omp_dir().join("models.yml")
}

pub fn get_omp_config_path() -> PathBuf {
    get_omp_dir().join("config.yml")
}

pub fn get_omp_mcp_path() -> PathBuf {
    get_omp_dir().join("mcp.json")
}

pub fn get_omp_agents_path() -> PathBuf {
    get_omp_dir().join("AGENTS.md")
}
