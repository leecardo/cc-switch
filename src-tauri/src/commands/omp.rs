use tauri::State;

use crate::omp_config;
use crate::store::AppState;

// ============================================================================
// OMP Provider Commands
// ============================================================================

/// Import providers from OMP live config to database.
///
/// OMP uses additive mode — users may already have providers
/// configured in models.yml.
#[tauri::command]
pub fn import_omp_providers_from_live(state: State<'_, AppState>) -> Result<usize, String> {
    crate::services::provider::import_omp_providers_from_live(state.inner()).map_err(|e| e.to_string())
}

/// Get provider names in the OMP live config (models.yml).
#[tauri::command]
pub fn get_omp_live_provider_ids() -> Result<Vec<String>, String> {
    let providers = omp_config::get_providers().map_err(|e| e.to_string())?;
    Ok(providers.keys().cloned().collect())
}

/// Get a single OMP provider fragment from live config (models.yml).
#[tauri::command]
pub fn get_omp_live_provider(
    #[allow(non_snake_case)] providerId: String,
) -> Result<Option<serde_json::Value>, String> {
    omp_config::get_provider(&providerId).map_err(|e| e.to_string())
}

/// Remove a provider from OMP live config (models.yml).
#[tauri::command]
pub fn remove_omp_provider_from_live(
    #[allow(non_snake_case)] providerId: String,
) -> Result<bool, String> {
    omp_config::remove_provider(&providerId).map_err(|e| e.to_string())?;
    Ok(true)
}

// ============================================================================
// OMP Config Commands
// ============================================================================

/// 读取 OMP config.yml 并返回 JSON。
#[tauri::command]
pub fn get_omp_config() -> Result<serde_json::Value, String> {
    omp_config::get_config_json().map_err(|e| e.to_string())
}

/// 更新 OMP config.yml（只合并允许的字段）。
#[tauri::command]
pub fn update_omp_config(config: serde_json::Value) -> Result<bool, String> {
    omp_config::update_config(config).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 获取 models.yml 中所有 provider 的 model 列表。
/// 返回 ["provider/model_id", ...] 格式的扁平列表。
#[tauri::command]
pub fn get_omp_available_models() -> Result<Vec<String>, String> {
    let providers = omp_config::get_providers().map_err(|e| e.to_string())?;
    let mut models = Vec::new();
    for (provider_id, config) in &providers {
        if let Some(arr) = config.get("models").and_then(|v| v.as_array()) {
            for m in arr {
                if let Some(id) = m.get("id").and_then(|v| v.as_str()) {
                    models.push(format!("{provider_id}/{id}"));
                }
            }
        }
    }
    Ok(models)
}