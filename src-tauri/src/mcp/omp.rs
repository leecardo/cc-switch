//! OMP MCP sync and import module
//!
//! Handles conversion between CC Switch unified MCP format and OMP mcp.json format.
//!
//! ## Format mapping
//!
//! OMP mcp.json format (same as Claude):
//! ```json
//! {
//!   "mcpServers": {
//!     "server-name": {
//!       "type": "stdio",
//!       "command": "npx",
//!       "args": ["-y", "some-mcp-server"]
//!     }
//!   },
//!   "disabledServers": ["server-name"]
//! }
//! ```

use serde_json::Value;
use std::collections::HashMap;

use crate::app_config::MultiAppConfig;
use crate::error::AppError;
use crate::omp_config;

use super::validation::{extract_server_spec, validate_server_spec};

fn should_sync_omp_mcp() -> bool {
    omp_config::get_omp_dir().exists() || omp_config::get_omp_mcp_path().exists()
}

// ============================================================================
// File I/O
// ============================================================================

fn read_mcp_json() -> Result<Option<serde_json::Value>, AppError> {
    let path = omp_config::get_omp_mcp_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))?;
    let value: Value = serde_json::from_str(&content)
        .map_err(|e| AppError::McpValidation(format!("Failed to parse mcp.json: {e}")))?;
    Ok(Some(value))
}

fn write_mcp_json(value: &Value) -> Result<(), AppError> {
    let path = omp_config::get_omp_mcp_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| AppError::Config(format!("Failed to serialize mcp.json: {e}")))?;
    crate::config::atomic_write(&path, content.as_bytes())
}

fn ensure_mcp_json() -> Result<serde_json::Map<String, Value>, AppError> {
    match read_mcp_json()? {
        Some(v) => Ok(v.as_object().cloned().unwrap_or_default()),
        None => {
            let mut map = serde_json::Map::new();
            map.insert("mcpServers".into(), Value::Object(serde_json::Map::new()));
            Ok(map)
        }
    }
}

// ============================================================================
// Sync: CC Switch -> OMP
// ============================================================================

/// Sync a single MCP server to OMP mcp.json
pub fn sync_single_server_to_omp(
    _config: &MultiAppConfig,
    id: &str,
    spec: &Value,
) -> Result<(), AppError> {
    if !should_sync_omp_mcp() {
        return Ok(());
    }

    let spec = extract_server_spec(spec)?;
    validate_server_spec(&spec)?;

    let mut root = ensure_mcp_json()?;

    // Ensure mcpServers object exists
    if !root.contains_key("mcpServers") {
        root.insert("mcpServers".into(), Value::Object(serde_json::Map::new()));
    }

    let servers = root
        .get_mut("mcpServers")
        .and_then(|v| v.as_object_mut())
        .unwrap();

    servers.insert(id.to_string(), spec);

    // Remove from disabledServers if present
    if let Some(disabled) = root.get_mut("disabledServers").and_then(|v| v.as_array_mut()) {
        disabled.retain(|v| v.as_str() != Some(id));
    }

    write_mcp_json(&Value::Object(root))
}

/// Remove a single MCP server from OMP mcp.json
pub fn remove_server_from_omp(id: &str) -> Result<(), AppError> {
    if !should_sync_omp_mcp() {
        return Ok(());
    }

    let Some(mut root) = read_mcp_json()?.and_then(|v| v.as_object().cloned()) else {
        return Ok(());
    };

    // Remove from mcpServers
    if let Some(servers) = root.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.remove(id);
    }

    // Remove from disabledServers
    if let Some(disabled) = root.get_mut("disabledServers").and_then(|v| v.as_array_mut()) {
        disabled.retain(|v| v.as_str() != Some(id));
    }

    write_mcp_json(&Value::Object(root))
}

// ============================================================================
// Import: OMP -> CC Switch
// ============================================================================

/// Import MCP servers from OMP mcp.json into CC Switch unified structure.
/// Existing servers will have OMP app enabled; new servers are created with only OMP enabled.
pub fn import_from_omp(config: &mut MultiAppConfig) -> Result<usize, AppError> {
    let Some(root) = read_mcp_json()? else {
        return Ok(0);
    };

    let Some(servers_map) = root.get("mcpServers").and_then(|v| v.as_object()) else {
        return Ok(0);
    };

    let servers = config.mcp.servers.get_or_insert_with(HashMap::new);
    let mut changed = 0;
    let mut errors = Vec::new();

    for (id, spec) in servers_map.iter() {
        if let Err(e) = validate_server_spec(spec) {
            log::warn!("Skipping invalid OMP MCP server '{id}': {e}");
            errors.push(format!("{id}: {e}"));
            continue;
        }

        if let Some(existing) = servers.get_mut(id) {
            // Already exists: just enable OMP app
            if !existing.apps.omp {
                existing.apps.omp = true;
                changed += 1;
                log::info!("MCP server '{id}' enabled for OMP");
            }
        } else {
            // New server: create with only OMP enabled
            let mut apps = crate::app_config::McpApps::default();
            apps.omp = true;

            let server = crate::app_config::McpServer {
                id: id.clone(),
                name: id.clone(),
                apps,
                server: spec.clone(),
                description: None,
                homepage: None,
                docs: None,
                tags: Vec::new(),
            };
            servers.insert(id.clone(), server);
            changed += 1;
            log::info!("Imported OMP MCP server '{id}'");
        }
    }

    if !errors.is_empty() {
        log::warn!("OMP MCP import had {} validation error(s)", errors.len());
    }

    Ok(changed)
}
