use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use crate::error::AppError;
use crate::settings::get_omp_override_dir;

// ============================================================================
// Path Functions
// ============================================================================

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

fn omp_write_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

// ============================================================================
// YAML ↔ JSON Helpers
// ============================================================================

pub(crate) fn yaml_to_json(yaml: &serde_yaml::Value) -> Result<serde_json::Value, AppError> {
    serde_json::to_value(yaml).map_err(|e| AppError::Config(format!("YAML to JSON conversion failed: {e}")))
}

pub(crate) fn json_to_yaml(json: &serde_json::Value) -> Result<serde_yaml::Value, AppError> {
    serde_yaml::to_value(json).map_err(|e| AppError::Config(format!("JSON to YAML conversion failed: {e}")))
}

// ============================================================================
// models.yml Read/Write
// ============================================================================

/// Read models.yml as serde_yaml::Value. Returns empty mapping if file doesn't exist.
pub fn read_models_yaml() -> Result<serde_yaml::Value, AppError> {
    let path = get_omp_models_path();
    if !path.exists() {
        return Ok(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))?;
    serde_yaml::from_str(&content).map_err(|e| AppError::Config(format!("Failed to parse models.yml: {e}")))
}

/// Write the entire models.yml file atomically.
fn write_models_yaml(yaml: &serde_yaml::Value) -> Result<(), AppError> {
    let path = get_omp_models_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }
    let content = serde_yaml::to_string(yaml)
        .map_err(|e| AppError::Config(format!("Failed to serialize models.yml: {e}")))?;
    crate::config::atomic_write(&path, content.as_bytes())
}

// ============================================================================
// Provider Functions
// ============================================================================

/// Get all providers from models.yml as a JSON map keyed by provider id.
pub fn get_providers() -> Result<serde_json::Map<String, serde_json::Value>, AppError> {
    let yaml = read_models_yaml()?;
    let Some(mapping) = yaml.get("providers").and_then(|v| v.as_mapping()) else {
        return Ok(serde_json::Map::new());
    };

    let mut map = serde_json::Map::new();
    for (key, value) in mapping {
        let Some(id) = key.as_str().map(str::trim).filter(|s| !s.is_empty()) else {
            continue;
        };
        match yaml_to_json(value) {
            Ok(mut json_val) => {
                // Inject provider_key for UI consistency
                if let Some(obj) = json_val.as_object_mut() {
                    obj.insert("provider_key".to_string(), serde_json::json!(id));
                }
                map.insert(id.to_string(), json_val);
            }
            Err(e) => {
                log::warn!("Failed to convert OMP provider '{id}' to JSON: {e}");
            }
        }
    }
    Ok(map)
}

/// Get a single provider by id.
pub fn get_provider(id: &str) -> Result<Option<serde_json::Value>, AppError> {
    Ok(get_providers()?.get(id).cloned())
}

/// Set (upsert) a provider in models.yml.
///
/// The provider id is used as the key in the `providers:` dict.
/// The `provider_key` UI marker is stripped before writing.
pub fn set_provider(id: &str, config: serde_json::Value) -> Result<(), AppError> {
    let _guard = omp_write_lock().lock()?;
    let mut yaml = read_models_yaml()?;

    // Ensure providers mapping exists
    if yaml.get("providers").is_none() {
        yaml.as_mapping_mut().unwrap().insert(
            serde_yaml::Value::String("providers".to_string()),
            serde_yaml::Value::Mapping(serde_yaml::Mapping::new()),
        );
    }

    // Strip UI-only markers before writing to YAML
    let mut config = config;
    if let Some(obj) = config.as_object_mut() {
        obj.remove("provider_key");
        obj.remove("_cc_source");
    }

    let yaml_val = json_to_yaml(&config)?;

    if let Some(providers) = yaml.get_mut("providers").and_then(|v| v.as_mapping_mut()) {
        providers.insert(
            serde_yaml::Value::String(id.to_string()),
            yaml_val,
        );
    }

    write_models_yaml(&yaml)
}

/// Remove a provider from models.yml.
pub fn remove_provider(id: &str) -> Result<(), AppError> {
    let _guard = omp_write_lock().lock()?;
    let mut yaml = read_models_yaml()?;

    if let Some(providers) = yaml.get_mut("providers").and_then(|v| v.as_mapping_mut()) {
        providers.remove(serde_yaml::Value::String(id.to_string()));
    }

    write_models_yaml(&yaml)
}

// ============================================================================
// config.yml - modelRoles.default
// ============================================================================

/// Read config.yml as serde_yaml::Value. Returns empty mapping if file doesn't exist.
pub fn read_config_yaml() -> Result<serde_yaml::Value, AppError> {
    let path = get_omp_config_path();
    if !path.exists() {
        return Ok(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))?;
    serde_yaml::from_str(&content).map_err(|e| AppError::Config(format!("Failed to parse config.yml: {e}")))
}

/// Write config.yml atomically, preserving unrelated sections.
///
/// Only replaces the top-level key matching `section_key` if it exists in `new_yaml`.
/// If `section_key` doesn't exist in the file, it's appended.
fn write_config_section(
    section_key: &str,
    section_value: &serde_yaml::Value,
) -> Result<(), AppError> {
    let path = get_omp_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }

    let mut yaml = read_config_yaml()?;

    // Ensure top-level mapping
    if !yaml.is_mapping() {
        yaml = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
    }

    if let Some(mapping) = yaml.as_mapping_mut() {
        mapping.insert(
            serde_yaml::Value::String(section_key.to_string()),
            section_value.clone(),
        );
    }

    let content = serde_yaml::to_string(&yaml)
        .map_err(|e| AppError::Config(format!("Failed to serialize config.yml: {e}")))?;
    crate::config::atomic_write(&path, content.as_bytes())
}

/// Apply switch defaults after changing the active provider.
///
/// Updates `modelRoles.default` in config.yml to point at the provider's
/// first declared model. Without this, switching providers in CC Switch
/// would only update models.yml while OMP continues using the old default.
///
/// The selector format is `provider/modelId` (e.g. `openrouter/claude-opus-4-6`).
pub fn apply_switch_defaults(
    provider_id: &str,
    provider_config: &serde_json::Value,
) -> Result<(), AppError> {
    // Determine the default model selector
    let model_id = provider_config
        .get("models")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            // Fallback: try to extract from provider-level model config
            provider_config
                .get("model")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        });

    let selector = match model_id {
        Some(id) => format!("{provider_id}/{id}"),
        None => {
            log::warn!(
                "OMP provider '{provider_id}' has no models, skipping modelRoles.default update"
            );
            return Ok(());
        }
    };

    // Read existing modelRoles or create new
    let config = read_config_yaml()?;
    let model_roles = config
        .get("modelRoles")
        .cloned()
        .unwrap_or_else(|| serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));

    let mut roles_mapping = match model_roles {
        serde_yaml::Value::Mapping(m) => m,
        _ => serde_yaml::Mapping::new(),
    };

    roles_mapping.insert(
        serde_yaml::Value::String("default".to_string()),
        serde_yaml::Value::String(selector),
    );

    write_config_section("modelRoles", &serde_yaml::Value::Mapping(roles_mapping))
}
