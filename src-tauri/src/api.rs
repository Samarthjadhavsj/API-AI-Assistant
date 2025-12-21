use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use reqwest::multipart::{Form, Part};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_machine_uid::MachineUidExt;

fn get_app_endpoint() -> Result<String, String> {
    if let Ok(endpoint) = env::var("APP_ENDPOINT") {
        return Ok(endpoint);
    }

    match option_env!("APP_ENDPOINT") {
        Some(endpoint) => Ok(endpoint.to_string()),
        None => Err("APP_ENDPOINT environment variable not set. Please ensure it's set during the build process.".to_string())
    }
}

fn get_api_access_key() -> Result<String, String> {
    if let Ok(key) = env::var("API_ACCESS_KEY") {
        return Ok(key);
    }

    match option_env!("API_ACCESS_KEY") {
        Some(key) => Ok(key.to_string()),
        None => Err("API_ACCESS_KEY environment variable not set. Please ensure it's set during the build process.".to_string())
    }
}

// Secure storage functions
fn get_secure_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("secure_storage.json"))
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct SecureStorage {
    license_key: Option<String>,
    instance_id: Option<String>,
    selected_pluely_model: Option<String>,
}

pub async fn get_stored_credentials(
    app: &AppHandle,
) -> Result<(String, String, Option<Model>), String> {
    let storage_path = get_secure_storage_path(app)?;

    if !storage_path.exists() {
        return Err("No license found. Please activate your license first.".to_string());
    }

    let content = fs::read_to_string(&storage_path)
        .map_err(|e| format!("Failed to read storage file: {}", e))?;

    let storage: SecureStorage = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse storage file: {}", e))?;

    let license_key = storage
        .license_key
        .ok_or("License key not found".to_string())?;
    let instance_id = storage
        .instance_id
        .ok_or("Instance ID not found".to_string())?;

    let selected_model: Option<Model> = storage
        .selected_pluely_model
        .and_then(|json_str| serde_json::from_str(&json_str).ok());

    Ok((license_key, instance_id, selected_model))
}

// Audio API Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioResponse {
    success: bool,
    transcription: Option<String>,
    error: Option<String>,
}

// Chat API Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    user_message: String,
    system_prompt: Option<String>,
    image_base64: Option<serde_json::Value>, // Can be string or array
    history: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    success: bool,
    message: Option<String>,
    error: Option<String>,
}

// Model API Structs
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Model {
    provider: String,
    name: String,
    id: String,
    model: String,
    description: String,
    modality: String,
    #[serde(rename = "isAvailable")]
    is_available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelsResponse {
    models: Vec<Model>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPromptResponse {
    prompt_name: String,
    system_prompt: String,
}

// API Response Configuration Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponseConfig {
    url: String,
    user_token: String,
    model: String,
    body: String,
    customer_id: Option<i64>,
    customer_email: Option<String>,
    customer_name: Option<String>,
    license_key: String,
    instance_id: String,
    #[serde(rename = "user_audio")]
    user_audio: Option<UserAudioConfig>,
    errors: Option<Vec<ApiConfigError>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiConfigError {
    includes: String,
    error: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAudioHeader {
    key: String,
    value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAudioConfig {
    url: String,
    #[serde(rename = "fallback_url")]
    fallback_url: Option<String>,
    model: String,
    #[serde(rename = "fallback_model")]
    fallback_model: Option<String>,
    #[serde(rename = "user_token")]
    user_token: String,
    #[serde(rename = "fallback_user_token")]
    fallback_user_token: Option<String>,
    headers: Option<Vec<UserAudioHeader>>,
}

// Audio API Command
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_base64: String,
) -> Result<AudioResponse, String> {
    let (_, _, selected_model) = get_stored_credentials(&app).await?;
    let provider = selected_model.as_ref().map(|model| model.provider.clone());
    let model = selected_model.as_ref().map(|model| model.model.clone());

    let api_config = fetch_api_response_config(&app, provider.clone(), model.clone()).await?;
    let user_audio_config = api_config.user_audio.as_ref().ok_or_else(|| {
        "Audio transcription is not configured for this workspace. Please contact support."
            .to_string()
    })?;

    let audio_bytes = decode_audio_base64(&audio_base64)?;
    let client = reqwest::Client::new();
    let error_provider = provider.clone();
    let error_model = model.clone();
    match perform_user_audio_transcription(
        &client,
        &user_audio_config.url,
        &user_audio_config.user_token,
        &user_audio_config.model,
        user_audio_config.headers.as_ref(),
        &audio_bytes,
    )
    .await
    {
        Ok(transcription) => Ok(AudioResponse {
            success: true,
            transcription: Some(transcription),
            error: None,
        }),
        Err(primary_error) => {
            let fallback_error_message = if let (Some(fallback_url), Some(fallback_token)) = (
                user_audio_config.fallback_url.as_ref(),
                user_audio_config.fallback_user_token.as_ref(),
            ) {
                let fallback_model = user_audio_config
                    .fallback_model
                    .as_ref()
                    .unwrap_or(&user_audio_config.model);

                match perform_user_audio_transcription(
                    &client,
                    fallback_url,
                    fallback_token,
                    fallback_model,
                    user_audio_config.headers.as_ref(),
                    &audio_bytes,
                )
                .await
                {
                    Ok(transcription) => {
                        return Ok(AudioResponse {
                            success: true,
                            transcription: Some(transcription),
                            error: None,
                        });
                    }
                    Err(fallback_error) => Some(fallback_error),
                }
            } else {
                Some("fallback not configured".to_string())
            };

            tracing::warn!(
                primary_error = %primary_error,
                fallback_error = %fallback_error_message
                    .as_deref()
                    .unwrap_or("not attempted"),
                "Audio transcription failed for all configured endpoints"
            );
            tauri::async_runtime::spawn({
                let app = app.clone();
                let error_msg = if let Some(fallback_err) = fallback_error_message {
                    format!("Primary: {} | Fallback: {}", primary_error, fallback_err)
                } else {
                    primary_error.clone()
                };
                async move {
                    report_api_error(app, error_msg, "/api/transcribe".to_string(), error_model, error_provider).await;
                }
            });
            Err("Transcription failed. Please try again.".to_string())
        }
    }
}

// Helper function to fetch API response configuration
async fn fetch_api_response_config(
    app: &AppHandle,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ApiResponseConfig, String> {
    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;
    let machine_id: String = app.machine_uid().get_machine_uid().unwrap().id.unwrap();

    // Get stored credentials
    let (license_key, instance_id, _) = get_stored_credentials(app).await?;

    // Make HTTP request to response endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/response", app_endpoint);

    let mut request = client
        .get(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance", &instance_id)
        .header("machine_id", &machine_id);

    // Add optional headers
    if let Some(p) = provider {
        request = request.header("provider", p);
    }
    if let Some(m) = model {
        request = request.header("model", m);
    }

    let response = request.send().await.map_err(|e| {
        let error_msg = format!("{}", e);
        if error_msg.contains("url (") {
            let parts: Vec<&str> = error_msg.split(" for url (").collect();
            if parts.len() > 1 {
                format!("Failed to fetch API config: {}", parts[0])
            } else {
                format!("Failed to fetch API config: {}", error_msg)
            }
        } else {
            format!("Failed to fetch API config: {}", error_msg)
        }
    })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }
    let api_config: ApiResponseConfig = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API config response: {}", e))?;
    Ok(api_config)
}

fn map_api_error_message(error_rules: &[ApiConfigError], sources: &[String]) -> String {
    for source in sources {
        for rule in error_rules {
            if !rule.includes.is_empty() && source.contains(&rule.includes) {
                return rule.error.clone();
            }
        }
    }

    if let Some(default_rule) = error_rules
        .iter()
        .find(|rule| rule.includes.trim().is_empty())
    {
        return default_rule.error.clone();
    }

    error_rules
        .first()
        .map(|rule| rule.error.clone())
        .unwrap_or_else(|| {
            "Something went wrong. Please try switching to a different model or contact support."
                .to_string()
        })
}

fn decode_audio_base64(audio_base64: &str) -> Result<Vec<u8>, String> {
    let trimmed = audio_base64.trim();
    let base64_str = if let Some(idx) = trimmed.find(',') {
        &trimmed[idx + 1..]
    } else {
        trimmed
    };

    general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| format!("Failed to decode audio data: {}", e))
}

async fn perform_user_audio_transcription(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    model: &str,
    headers: Option<&Vec<UserAudioHeader>>,
    audio_bytes: &[u8],
) -> Result<String, String> {
    let audio_part = Part::bytes(audio_bytes.to_vec())
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to prepare audio payload: {}", e))?;

    let mut form = Form::new()
        .part("file", audio_part)
        .text("model", model.to_string());

    if let Some(extra_headers) = headers {
        for header in extra_headers {
            let key = header.key.trim();
            if key.is_empty() {
                continue;
            }

            form = form.text(key.to_string(), header.value.clone());
        }
    }

    let response = client
        .post(url)
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Transcription request failed to send: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read transcription error response".to_string());
        return Err(format!(
            "Transcription request returned {} with body: {}",
            status, error_text
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read transcription response: {}", e))?;

    if body_text.trim().is_empty() {
        return Err("Transcription response was empty".to_string());
    }

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
        if let Some(text) = json.get("text").and_then(|value| value.as_str()) {
            return Ok(text.to_string());
        }

        if let Some(text) = json
            .get("transcription")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("result").and_then(|value| value.as_str()))
        {
            return Ok(text.to_string());
        }

        return Ok(json.to_string());
    }

    Ok(body_text)
}

#[tauri::command]
pub async fn chat_stream_response(
    _app: AppHandle,
    _user_message: String,
    _system_prompt: Option<String>,
    _image_base64: Option<serde_json::Value>,
    _history: Option<String>,
) -> Result<String, String> {
    // Return empty string to signal that frontend should handle the request directly
    // This allows the TypeScript code to make direct API calls to Gemini
    Ok(String::new())
}

async fn user_activity(
    app: AppHandle,
    activity_metrics: Option<serde_json::Value>,
    configured_model: String,
    app_version: String,
) -> Result<(), String> {
    let app_endpoint = match get_app_endpoint() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    let api_access_key = match get_api_access_key() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    let (license_key, instance_id, stored_model) = match get_stored_credentials(&app).await {
        Ok(values) => values,
        Err(_) => return Ok(()),
    };

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_else(String::new),
        Err(_) => String::new(),
    };

    if machine_id.is_empty() {
        return Ok(());
    }

    let ai_model = stored_model
        .as_ref()
        .map(|model| model.model.clone())
        .unwrap_or(configured_model);

    let mut payload = serde_json::json!({
        "license": license_key,
        "instance": instance_id,
        "machine_id": machine_id,
        "app_version": app_version,
        "ai_model": ai_model,
    });

    if let Some(metrics) = activity_metrics {
        if let Some(obj) = payload.as_object_mut() {
            const METRIC_FIELD_BYTES: [u8; 5] = [117, 115, 97, 103, 101];
            if let Ok(field) = std::str::from_utf8(&METRIC_FIELD_BYTES) {
                obj.insert(field.to_string(), metrics);
            }
        }
    }

    let activity_url = format!("{}/api/activity", app_endpoint.trim_end_matches('/'));
    let client = reqwest::Client::new();

    let _ = client
        .post(&activity_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await;

    Ok(())
}

async fn report_api_error(
    app: AppHandle,
    error_message: String,
    endpoint: String,
    model: Option<String>,
    provider: Option<String>,
) {
    let app_endpoint = match get_app_endpoint() {
        Ok(value) => value,
        Err(_) => return,
    };

    let api_access_key = match get_api_access_key() {
        Ok(value) => value,
        Err(_) => return,
    };

    let (license_key, instance_id, stored_model) = match get_stored_credentials(&app).await {
        Ok(values) => values,
        Err(_) => return,
    };

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_default(),
        Err(_) => return,
    };

    if machine_id.is_empty() {
        return;
    }

    let app_version = app.package_info().version.to_string();

    let final_model = model
        .or_else(|| stored_model.as_ref().map(|m| m.model.clone()))
        .unwrap_or_default();

    let final_provider = provider
        .or_else(|| stored_model.as_ref().map(|m| m.provider.clone()))
        .unwrap_or_default();

    let payload = serde_json::json!({
        "machine_id": machine_id,
        "error_message": error_message,
        "app_version": app_version,
        "instance": instance_id,
        "license_key": license_key,
        "endpoint": endpoint,
        "model": final_model,
        "provider": final_provider
    });

    let error_url = format!("{}/api/error", app_endpoint.trim_end_matches('/'));
    let client = reqwest::Client::new();

    tracing::debug!("Reporting API error: {:?}", payload);

    if let Err(e) = client
        .post(&error_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
    {
        tracing::warn!("Failed to report API error: {}", e);
    }
}

// Models API Command
#[tauri::command]
pub async fn fetch_models() -> Result<Vec<Model>, String> {
    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;

    // Make HTTP request to models endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/models", app_endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                // Remove the URL part from the error message
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to make models request: {}", parts[0])
                } else {
                    format!("Failed to make models request: {}", error_msg)
                }
            } else {
                format!("Failed to make models request: {}", error_msg)
            }
        })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    let models_response: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models_response.models)
}

// Create System Prompt API Command
#[tauri::command]
pub async fn create_system_prompt(
    app: AppHandle,
    user_prompt: String,
) -> Result<SystemPromptResponse, String> {
    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;
    let (license_key, instance_id, _) = get_stored_credentials(&app).await?;
    let machine_id: String = app.machine_uid().get_machine_uid().unwrap().id.unwrap();
    let app_version: String = app.package_info().version.to_string();
    // Make HTTP request to models endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/prompt", app_endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance", &instance_id)
        .header("machine_id", &machine_id)
        .header("app_version", &app_version)
        .json(&serde_json::json!({
            "user_prompt": user_prompt
        }))
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                // Remove the URL part from the error message
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to make models request: {}", parts[0])
                } else {
                    format!("Failed to make models request: {}", error_msg)
                }
            } else {
                format!("Failed to make models request: {}", error_msg)
            }
        })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    let system_prompt_response: SystemPromptResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse system prompt response: {}", e))?;

    Ok(system_prompt_response)
}

// Helper command to check if license is available
#[tauri::command]
pub async fn check_license_status(app: AppHandle) -> Result<bool, String> {
    match get_stored_credentials(&app).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[allow(dead_code)]
#[tauri::command]
pub async fn get_activity(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;

    let (license_key, instance_id, _) = get_stored_credentials(&app).await?;

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_default(),
        Err(_) => String::new(),
    };

    if machine_id.is_empty() {
        return Err("Machine identifier unavailable".to_string());
    }

    let app_version = app.package_info().version.to_string();

    let client = reqwest::Client::new();
    let activity_url = format!("{}/api/activity", app_endpoint.trim_end_matches('/'));

    let response = client
        .get(&activity_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance_name", &instance_id)
        .header("machine_id", machine_id)
        .header("app_version", app_version)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to request activity: {}", parts[0])
                } else {
                    format!("Failed to request activity: {}", error_msg)
                }
            } else {
                format!("Failed to request activity: {}", error_msg)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(message) = error_json
                .get("message")
                .and_then(|m| m.as_str())
                .or_else(|| error_json.get("error").and_then(|m| m.as_str()))
            {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse activity response: {}", e))
}
