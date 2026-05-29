use cc_switch_lib::{first_launch_prompt_import_apps, AppType};

#[test]
fn first_launch_prompt_import_apps_include_omp() {
    assert!(
        first_launch_prompt_import_apps()
            .into_iter()
            .any(|app| matches!(app, AppType::Omp)),
        "OMP AGENTS.md must be included in first-launch prompt import"
    );
}
