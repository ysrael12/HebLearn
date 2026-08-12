mod ai;
mod db;
mod images;
mod keywords;
mod translation;
mod wikipedia;

use base64::Engine;
use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: reqwest::Client,
    pub ai: tokio::sync::Mutex<Option<ai::AiDaemon>>,
    pub ai_python: Option<PathBuf>,
    pub ai_daemon_script: Option<PathBuf>,
    pub tts_model: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
struct ArticleDetail {
    article_id: i64,
    title_he: String,
    title: String,
    url: String,
    paragraph_count: usize,
}

#[derive(Debug, Serialize)]
struct ReadingContext {
    article: ArticleDetail,
    paragraphs: Vec<String>,
    current_paragraph_index: usize,
    total_paragraphs: usize,
    completed: bool,
}

#[derive(Debug, Serialize)]
struct ReadingHistoryItem {
    article_id: i64,
    title_he: String,
    title: String,
    current_paragraph_index: i64,
    total_paragraphs: i64,
    completed: bool,
}

#[derive(Debug, Serialize)]
struct NikudResult {
    text: String,
    nikud_applied: bool,
}

#[derive(Debug, Serialize)]
struct AudioResult {
    data_b64: String,
    from_cache: bool,
}

#[derive(Debug, Serialize)]
struct Flashcard {
    word_he: String,
    word_nikud: String,
    learned: bool,
}

/// Spec 11 — idiomas de interface suportados (valores BCP-47).
const SUPPORTED_UI_LANGS: &[&str] = &["pt-BR", "en", "es"];

/// Mapeia `ui_lang` (BCP-47) para o par (código da Wikipédia, código de tradução).
/// O idioma configurado dirige busca de artigos e tradução he→idioma.
fn lang_codes(ui_lang: &str) -> (&'static str, &'static str) {
    match ui_lang {
        "en" => ("en", "en"),
        "es" => ("es", "es"),
        // pt-BR (padrão) e qualquer valor não suportado.
        _ => ("pt", "pt"),
    }
}

#[derive(Debug, Serialize)]
struct UiConfig {
    ui_lang: String,
    first_run: bool,
}

/// Spec 11 — lê o idioma da interface e detecta primeira execução
/// (ausência da chave `ui_lang` em `app_config`).
#[tauri::command]
fn get_ui_config(state: tauri::State<'_, AppState>) -> Result<UiConfig, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let stored = db::get_config(&conn, "ui_lang")
        .map_err(|e| format!("falha ao ler configuração: {e}"))?;
    let ui_lang = match stored.as_deref() {
        // ER-11-02: valor não suportado → fallback pt-BR e reescreve a chave.
        Some(lang) if SUPPORTED_UI_LANGS.contains(&lang) => lang.to_string(),
        _ => {
            if stored.is_some() {
                let _ = db::set_config(&conn, "ui_lang", "pt-BR");
            }
            "pt-BR".to_string()
        }
    };
    Ok(UiConfig {
        ui_lang,
        first_run: stored.is_none(),
    })
}

/// Spec 11 — persiste o idioma da interface em `app_config`.
#[tauri::command]
fn set_ui_lang(state: tauri::State<'_, AppState>, ui_lang: String) -> Result<(), String> {
    if !SUPPORTED_UI_LANGS.contains(&ui_lang.as_str()) {
        return Err(format!("idioma de interface não suportado: {ui_lang}"));
    }
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::set_config(&conn, "ui_lang", &ui_lang)
        .map_err(|e| format!("falha ao salvar configuração: {e}"))
}

/// Spec 08 — preferências persistidas em `app_config` (DR-08-01).
#[derive(Debug, Serialize)]
struct Prefs {
    font_size: String,
    theme: String,
    tts_speed: f64,
    tts_voice: String,
    auto_translate: bool,
    study_mode: String,
    flashcards_per_paragraph: i64,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            font_size: "medium".into(),
            theme: "auto".into(),
            // 0.75× ≈ ritmo lento de aprendizagem (equivalente ao length_scale 1.5 anterior).
            tts_speed: 0.75,
            tts_voice: "default".into(),
            auto_translate: true,
            study_mode: "full".into(),
            flashcards_per_paragraph: 5,
        }
    }
}

const PREF_KEYS: &[&str] = &[
    "font_size",
    "theme",
    "tts_speed",
    "tts_voice",
    "auto_translate",
    "study_mode",
    "flashcards_per_paragraph",
];

/// Spec 08 — lê todas as preferências de `app_config` com os padrões (FR-08-12).
#[tauri::command]
fn get_prefs(state: tauri::State<'_, AppState>) -> Result<Prefs, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let mut prefs = Prefs::default();
    for key in PREF_KEYS {
        let Some(value) = db::get_config(&conn, key)
            .map_err(|e| format!("falha ao ler configuração: {e}"))?
        else {
            continue;
        };
        match *key {
            "font_size" => prefs.font_size = value,
            "theme" => prefs.theme = value,
            "tts_speed" => prefs.tts_speed = value.parse().unwrap_or(prefs.tts_speed),
            "tts_voice" => prefs.tts_voice = value,
            "auto_translate" => prefs.auto_translate = value == "true",
            "study_mode" => prefs.study_mode = value,
            "flashcards_per_paragraph" => {
                prefs.flashcards_per_paragraph = value.parse().unwrap_or(prefs.flashcards_per_paragraph)
            }
            _ => {}
        }
    }
    Ok(prefs)
}

/// Spec 08 — valida e persiste uma preferência isolada (DR-08-02).
/// ER-08-01 (falha ao persistir) é tratado no frontend, que reverte o valor.
#[tauri::command]
fn set_pref(state: tauri::State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let valid = match key.as_str() {
        "font_size" => matches!(value.as_str(), "small" | "medium" | "large"),
        "theme" => matches!(value.as_str(), "light" | "dark" | "auto"),
        "tts_speed" => value
            .parse::<f64>()
            .map(|s| (0.5..=2.0).contains(&s))
            .unwrap_or(false),
        // ER-08-02: só a voz embutida do modelo existe hoje.
        "tts_voice" => value == "default",
        "auto_translate" => value == "true" || value == "false",
        "study_mode" => matches!(value.as_str(), "full" | "reading"),
        "flashcards_per_paragraph" => value
            .parse::<i64>()
            .map(|n| (1..=20).contains(&n))
            .unwrap_or(false),
        _ => return Err(format!("chave de preferência desconhecida: {key}")),
    };
    if !valid {
        return Err(format!("valor inválido para {key}: {value}"));
    }
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::set_config(&conn, &key, &value)
        .map_err(|e| format!("falha ao salvar configuração: {e}"))
}

/// Spec 08 — tamanho do cache por serviço (FR-08-09).
#[derive(Debug, Serialize)]
struct CacheStats {
    nikud_bytes: i64,
    audio_bytes: i64,
    translation_bytes: i64,
    image_bytes: i64,
    total_bytes: i64,
}

#[tauri::command]
fn get_cache_stats(state: tauri::State<'_, AppState>) -> Result<CacheStats, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let (nikud, audio, translations, images) =
        db::get_cache_stats(&conn).map_err(|e| format!("falha ao ler o cache: {e}"))?;
    Ok(CacheStats {
        nikud_bytes: nikud,
        audio_bytes: audio,
        translation_bytes: translations,
        image_bytes: images,
        total_bytes: nikud + audio + translations + images,
    })
}

/// Spec 08 — limpa os caches (FR-08-10).
#[tauri::command]
fn clear_cache(state: tauri::State<'_, AppState>) -> Result<CacheStats, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::clear_cache(&conn).map_err(|e| format!("falha ao limpar o cache: {e}"))?;
    Ok(CacheStats {
        nikud_bytes: 0,
        audio_bytes: 0,
        translation_bytes: 0,
        image_bytes: 0,
        total_bytes: 0,
    })
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "Aprendiz de Hebraico",
        "version": env!("CARGO_PKG_VERSION"),
        "spec_version": "0.1.0",
    })
}

#[tauri::command]
fn db_status(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let articles: i64 = conn
        .query_row("SELECT COUNT(*) FROM articles", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let words: i64 = conn
        .query_row("SELECT COUNT(*) FROM learned_words", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "ok": true,
        "articles_count": articles,
        "learned_words_count": words,
    }))
}

/// Busca artigos na Wikipédia do idioma configurado (Spec 02/11).
#[tauri::command]
async fn wiki_search(
    state: tauri::State<'_, AppState>,
    query: String,
    ui_lang: String,
) -> Result<Vec<wikipedia::ArticlePreview>, String> {
    let (wiki_code, _) = lang_codes(&ui_lang);
    wikipedia::search(&state.http, wiki_code, &query).await
}

/// Sugestões de autocomplete no idioma configurado (Spec 02/11).
#[tauri::command]
async fn wiki_autocomplete(
    state: tauri::State<'_, AppState>,
    query: String,
    ui_lang: String,
) -> Result<Vec<String>, String> {
    let (wiki_code, _) = lang_codes(&ui_lang);
    wikipedia::autocomplete(&state.http, wiki_code, &query).await
}

/// Abre artigo: resolve o título hebraico a partir da wiki do idioma configurado.
#[tauri::command]
async fn wiki_open_article(
    state: tauri::State<'_, AppState>,
    pt_title: String,
    ui_lang: String,
) -> Result<ArticleDetail, String> {
    let (wiki_code, _) = lang_codes(&ui_lang);
    let he_title = wikipedia::resolve_he_title(&state.http, wiki_code, &pt_title).await?;
    let paragraphs = wikipedia::fetch_paragraphs(&state.http, &he_title).await?;
    let url = wikipedia::article_url(&he_title);

    let mut conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("falha ao iniciar transação: {e}"))?;

    let article_id = match db::find_article_by_title_he(&tx, &he_title)
        .map_err(|e| format!("falha ao consultar artigos: {e}"))?
    {
        Some(id) => {
            db::replace_paragraphs(&tx, id, &paragraphs)
                .map_err(|e| format!("falha ao atualizar parágrafos: {e}"))?;
            id
        }
        None => {
            let id = db::insert_article(&tx, &he_title, &pt_title, &url)
                .map_err(|e| format!("falha ao salvar artigo: {e}"))?;
            db::insert_paragraphs(&tx, id, &paragraphs)
                .map_err(|e| format!("falha ao salvar parágrafos: {e}"))?;
            id
        }
    };
    db::ensure_user_progress(&tx, article_id, paragraphs.len() as i64)
        .map_err(|e| format!("falha ao salvar progresso: {e}"))?;
    tx.commit()
        .map_err(|e| format!("falha ao confirmar transação: {e}"))?;

    Ok(ArticleDetail {
        article_id,
        title_he: he_title,
        title: pt_title,
        url,
        paragraph_count: paragraphs.len(),
    })
}

/// Carrega o contexto de leitura (artigo + parágrafos + progresso) para a Spec 03.
#[tauri::command]
fn get_reading_context(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> Result<ReadingContext, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;

    let article = db::get_article(&conn, article_id)
        .map_err(|e| format!("falha ao consultar artigo: {e}"))?
        .ok_or_else(|| format!("artigo {article_id} não encontrado."))?;

    let paragraphs = db::get_paragraphs(&conn, article_id)
        .map_err(|e| format!("falha ao consultar parágrafos: {e}"))?;
    if paragraphs.is_empty() {
        return Err("Este artigo não possui parágrafos.".to_string());
    }

    let (current, total, completed) = db::get_user_progress(&conn, article_id)
        .map_err(|e| format!("falha ao consultar progresso: {e}"))?
        .unwrap_or((0, paragraphs.len() as i64, false));

    let paragraph_count = paragraphs.len();
    let current = (current as usize).min(paragraph_count.saturating_sub(1));

    Ok(ReadingContext {
        article: ArticleDetail {
            article_id,
            title_he: article.0,
            title: article.1,
            url: article.2,
            paragraph_count,
        },
        paragraphs,
        current_paragraph_index: current,
        total_paragraphs: total.max(paragraph_count as i64) as usize,
        completed,
    })
}

/// Lista os artigos já abertos (para a sidebar "Continuar Leitura").
#[tauri::command]
fn get_reading_history(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ReadingHistoryItem>, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let rows = db::get_reading_history(&conn)
        .map_err(|e| format!("falha ao consultar histórico: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(article_id, title_he, title, current, total, completed)| {
            ReadingHistoryItem {
                article_id,
                title_he,
                title,
                current_paragraph_index: current,
                total_paragraphs: total,
                completed,
            }
        })
        .collect())
}

/// Aplica nikud a um parágrafo sob demanda, usando `nikud_cache` antes do subprocesso.
#[tauri::command]
async fn get_paragraph_nikud(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    paragraph_index: i64,
) -> Result<NikudResult, String> {
    let text = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        db::get_paragraph(&conn, article_id, paragraph_index)
            .map_err(|e| format!("falha ao consultar parágrafo: {e}"))?
            .ok_or_else(|| format!("parágrafo {paragraph_index} não encontrado."))?
    };

    {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        if let Some(cached) = db::get_nikud_cached(&conn, &text)
            .map_err(|e| format!("falha ao consultar cache de nikud: {e}"))?
        {
            return Ok(NikudResult {
                text: cached,
                nikud_applied: true,
            });
        }
    }

    let mut ai_guard = state.ai.lock().await;
    if ai_guard.is_none() {
        if let (Some(python), Some(script)) = (
            state.ai_python.as_ref(),
            state.ai_daemon_script.as_ref(),
        ) {
            match ai::AiDaemon::spawn(
                python.to_str().unwrap_or_default(),
                script.to_str().unwrap_or_default(),
                state
                    .tts_model
                    .as_ref()
                    .map(|p| p.to_str().unwrap_or_default())
                    .unwrap_or_default(),
            )
            .await
            {
                Ok(d) => *ai_guard = Some(d),
                Err(e) => eprintln!("[ia] aviso: {e}"),
            }
        }
    }

    let result = match ai_guard.as_mut() {
        Some(daemon) => daemon.add_nikud(&text).await,
        None => Err("Serviço de nikud indisponível.".to_string()),
    };

    match result {
        Ok(nikud_text) => {
            let conn = state
                .db
                .lock()
                .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
            db::put_nikud_cache(&conn, &text, &nikud_text)
                .map_err(|e| format!("falha ao salvar cache de nikud: {e}"))?;
            Ok(NikudResult {
                text: nikud_text,
                nikud_applied: true,
            })
        }
        Err(e) => {
            eprintln!("[ia] aviso nikud(art={article_id}, p={paragraph_index}): {e}");
            // Daemon morto/falhou → derruba para reiniciar na próxima chamada.
            if ai_guard.is_some() {
                *ai_guard = None;
            }
            // ER-03-01: exibe o texto sem nikud com aviso na interface.
            Ok(NikudResult {
                text,
                nikud_applied: false,
            })
        }
    }
}

/// Gera ou recupera o áudio TTS de um parágrafo, usando `audio_cache`.
/// O texto sintetizado é o com nikud (quando disponível), conforme FR-03-05.
#[tauri::command]
async fn get_paragraph_audio(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    paragraph_index: i64,
) -> Result<AudioResult, String> {
    let text = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        db::get_paragraph(&conn, article_id, paragraph_index)
            .map_err(|e| format!("falha ao consultar parágrafo: {e}"))?
            .ok_or_else(|| format!("parágrafo {paragraph_index} não encontrado."))?
    };

    // Prefere o texto com nikud (o que o usuário lê); senão o texto original.
    let tts_text = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        db::get_nikud_cached(&conn, &text)
            .map_err(|e| format!("falha ao consultar cache de nikud: {e}"))?
            .unwrap_or_else(|| text.clone())
    };

    let hash = ai::text_hash(&tts_text);
    {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        if let Some(audio) = db::get_audio_cached(&conn, &hash)
            .map_err(|e| format!("falha ao consultar cache de áudio: {e}"))?
        {
            return Ok(AudioResult {
                data_b64: base64::engine::general_purpose::STANDARD.encode(audio),
                from_cache: true,
            });
        }
    }

    let mut ai_guard = state.ai.lock().await;
    if ai_guard.is_none() {
        if let (Some(python), Some(script)) = (
            state.ai_python.as_ref(),
            state.ai_daemon_script.as_ref(),
        ) {
            match ai::AiDaemon::spawn(
                python.to_str().unwrap_or_default(),
                script.to_str().unwrap_or_default(),
                state
                    .tts_model
                    .as_ref()
                    .map(|p| p.to_str().unwrap_or_default())
                    .unwrap_or_default(),
            )
            .await
            {
                Ok(d) => *ai_guard = Some(d),
                Err(e) => eprintln!("[ia] aviso: {e}"),
            }
        }
    }

    let audio = match ai_guard.as_mut() {
        Some(daemon) => daemon.synthesize(&tts_text).await,
        None => Err("Áudio não está disponível no momento.".to_string()),
    }
    .map_err(|e| {
        eprintln!("[ia] aviso tts(art={article_id}, p={paragraph_index}): {e}");
        if ai_guard.is_some() {
            *ai_guard = None;
        }
        e
    })?;

    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::put_audio_cache(&conn, &hash, &audio)
        .map_err(|e| format!("falha ao salvar cache de áudio: {e}"))?;

    Ok(AudioResult {
        data_b64: base64::engine::general_purpose::STANDARD.encode(audio),
        from_cache: false,
    })
}

/// Gera ou recupera o áudio TTS de uma palavra isolada, usando `audio_cache`.
#[tauri::command]
async fn get_word_audio(
    state: tauri::State<'_, AppState>,
    word: String,
) -> Result<AudioResult, String> {
    let word = word.trim().to_string();
    if word.is_empty() {
        return Err("Palavra vazia.".to_string());
    }

    let hash = ai::text_hash(&word);
    {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        if let Some(audio) = db::get_audio_cached(&conn, &hash)
            .map_err(|e| format!("falha ao consultar cache de áudio: {e}"))?
        {
            return Ok(AudioResult {
                data_b64: base64::engine::general_purpose::STANDARD.encode(audio),
                from_cache: true,
            });
        }
    }

    let mut ai_guard = state.ai.lock().await;
    if ai_guard.is_none() {
        if let (Some(python), Some(script)) = (
            state.ai_python.as_ref(),
            state.ai_daemon_script.as_ref(),
        ) {
            match ai::AiDaemon::spawn(
                python.to_str().unwrap_or_default(),
                script.to_str().unwrap_or_default(),
                state
                    .tts_model
                    .as_ref()
                    .map(|p| p.to_str().unwrap_or_default())
                    .unwrap_or_default(),
            )
            .await
            {
                Ok(d) => *ai_guard = Some(d),
                Err(e) => eprintln!("[ia] aviso: {e}"),
            }
        }
    }

    let audio = match ai_guard.as_mut() {
        Some(daemon) => daemon.synthesize(&word).await,
        None => Err("Áudio não está disponível no momento.".to_string()),
    }
    .map_err(|e| {
        eprintln!("[ia] aviso tts(palavra): {e}");
        if ai_guard.is_some() {
            *ai_guard = None;
        }
        e
    })?;

    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::put_audio_cache(&conn, &hash, &audio)
        .map_err(|e| format!("falha ao salvar cache de áudio: {e}"))?;

    Ok(AudioResult {
        data_b64: base64::engine::general_purpose::STANDARD.encode(audio),
        from_cache: false,
    })
}

/// Traduz uma palavra hebraica para o idioma configurado (Spec 04/11), com cache.
#[tauri::command]
async fn get_word_translation(
    state: tauri::State<'_, AppState>,
    word: String,
    ui_lang: String,
) -> Result<String, String> {
    let word = word.trim().to_string();
    if word.is_empty() {
        return Err("Palavra vazia.".to_string());
    }
    let (_, target) = lang_codes(&ui_lang);

    {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        if let Some(cached) = db::get_translation_cached(&conn, &word, target)
            .map_err(|e| format!("falha ao consultar cache de tradução: {e}"))?
        {
            return Ok(cached);
        }
    }

    let base_url = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        db::get_config(&conn, "lt_url")
            .map_err(|e| format!("falha ao ler configuração de tradução: {e}"))?
    };
    let base_url = translation::lt_url(base_url);

    let translated = translation::translate(&state.http, &base_url, &word, target).await?;

    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::put_translation_cache(&conn, &word, &translated, target)
        .map_err(|e| format!("falha ao salvar cache de tradução: {e}"))?;

    Ok(translated)
}

/// Adiciona uma palavra aos flashcards (learned_words), sem duplicar.
#[tauri::command]
fn add_learned_word(
    state: tauri::State<'_, AppState>,
    word_he: String,
    word_pt: String,
) -> Result<bool, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::add_learned_word(&conn, &word_he, &word_pt)
        .map_err(|e| format!("falha ao salvar palavra: {e}"))
}

/// Gera os flashcards do parágrafo (Spec 05): palavras-chave + estado aprendida.
#[tauri::command]
fn get_flashcards(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    paragraph_index: i64,
) -> Result<Vec<Flashcard>, String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;

    let plain = db::get_paragraph(&conn, article_id, paragraph_index)
        .map_err(|e| format!("falha ao consultar parágrafo: {e}"))?
        .ok_or_else(|| format!("parágrafo {paragraph_index} não encontrado."))?;

    let dotted = db::get_nikud_cached(&conn, &plain)
        .map_err(|e| format!("falha ao consultar nikud: {e}"))?
        .unwrap_or_else(|| plain.clone());

    let learned_set: std::collections::HashSet<String> = db::get_learned_words(&conn)
        .map_err(|e| format!("falha ao consultar palavras: {e}"))?
        .into_iter()
        .collect();

    let cards = keywords::extract_keywords(&dotted)
        .into_iter()
        .map(|(word_he, word_nikud)| Flashcard {
            learned: learned_set.contains(&word_he),
            word_he,
            word_nikud,
        })
        .collect();

    Ok(cards)
}

/// Busca imagem ilustrativa para uma palavra (Spec 05), com cache.
/// O termo de busca é a tradução no idioma configurado (imagens mais relevantes).
#[tauri::command]
async fn get_word_image(
    state: tauri::State<'_, AppState>,
    word: String,
    ui_lang: String,
) -> Result<String, String> {
    let word = word.trim().to_string();
    if word.is_empty() {
        return Ok(String::new());
    }
    let (_, target) = lang_codes(&ui_lang);

    // 1. Tradução (cache → serviço) para usar como termo de busca.
    let translation: Option<String> = {
        let cached = {
            let conn = state
                .db
                .lock()
                .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
            db::get_translation_cached(&conn, &word, target)
                .map_err(|e| format!("falha ao consultar cache de tradução: {e}"))?
        };
        match cached {
            Some(t) => Some(t),
            None => {
                let base_url = {
                    let conn = state
                        .db
                        .lock()
                        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
                    db::get_config(&conn, "lt_url")
                        .map_err(|e| format!("falha ao ler configuração: {e}"))?
                };
                let base_url = translation::lt_url(base_url);
                match translation::translate(&state.http, &base_url, &word, target).await {
                    Ok(t) => {
                        let conn = state
                            .db
                            .lock()
                            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
                        db::put_translation_cache(&conn, &word, &t, target)
                            .map_err(|e| format!("falha ao salvar cache: {e}"))?;
                        Some(t)
                    }
                    Err(_) => None,
                }
            }
        }
    };

    let query = translation
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| word.clone());

    // 2. Imagem com cache pelo termo de busca.
    {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        if let Some(url) = db::get_image_cached(&conn, &query)
            .map_err(|e| format!("falha ao consultar cache de imagens: {e}"))?
        {
            return Ok(url);
        }
    }

    let url = images::search_image(&state.http, &query).await?;

    if !url.is_empty() {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
        db::put_image_cache(&conn, &query, &[url.clone()])
            .map_err(|e| format!("falha ao salvar cache de imagens: {e}"))?;
    }

    Ok(url)
}

/// Marca palavra como aprendida (learned=true) ou para revisar (learned=false).
#[tauri::command]
fn mark_word(
    state: tauri::State<'_, AppState>,
    word_he: String,
    learned: bool,
) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::mark_word(&conn, &word_he, learned)
        .map_err(|e| format!("falha ao marcar palavra: {e}"))
}

/// Remove um artigo e seu progresso do banco (lixeira da sidebar).
#[tauri::command]
fn delete_article(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    db::delete_article(&conn, article_id)
        .map_err(|e| format!("falha ao excluir artigo: {e}"))
}

/// Persiste o progresso de leitura a cada navegação (FR-03-09).
#[tauri::command]
fn set_progress(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    paragraph_index: i64,
) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|e| format!("falha ao acessar o banco: {e}"))?;
    let total = db::get_paragraphs(&conn, article_id)
        .map_err(|e| format!("falha ao consultar parágrafos: {e}"))?
        .len() as i64;
    db::update_user_progress(&conn, article_id, paragraph_index, total)
        .map_err(|e| format!("falha ao salvar progresso: {e}"))
}

/// Resolve o Python embutido + script do daemon de IA + modelo de voz TTS.
/// Em produção usa `resource_dir`; em dev usa `CARGO_MANIFEST_DIR` (sem bundle).
fn resolve_ai_runtime(app: &tauri::App) -> (Option<PathBuf>, Option<PathBuf>, Option<PathBuf>) {
    let mut python: Option<PathBuf> = None;
    let mut script: Option<PathBuf> = None;
    let mut tts_model: Option<PathBuf> = None;

    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("nikud").join("python").join("python.exe");
        if p.exists() {
            python = Some(p);
        }
        let s = dir.join("nikud").join("ai_daemon.py");
        if s.exists() {
            script = Some(s);
        }
        let m = dir
            .join("tts")
            .join("he_IL-saspeech-medium.onnx");
        if m.exists() {
            tts_model = Some(m);
        }
    }

    let dev_python = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("nikud")
        .join("python")
        .join("python.exe");
    let dev_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("nikud")
        .join("ai_daemon.py");
    let dev_model = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("tts")
        .join("he_IL-saspeech-medium.onnx");

    (
        python.or_else(|| dev_python.exists().then(|| dev_python)),
        script.or_else(|| dev_script.exists().then(|| dev_script)),
        tts_model.or_else(|| dev_model.exists().then(|| dev_model)),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("falha ao resolver diretório de dados: {e}"))?;
            let conn = db::open(&data_dir)
                .map_err(|e| format!("falha ao inicializar o banco de dados: {e}"))?;
            let http = reqwest::Client::builder()
                .user_agent("Heblearn/0.1 (Aprendiz de Hebraico; Tauri desktop app)")
                .build()
                .map_err(|e| format!("falha ao criar cliente HTTP: {e}"))?;
            let (ai_python, ai_daemon_script, tts_model) = resolve_ai_runtime(app);
            if ai_python.is_none() {
                eprintln!("[ia] aviso: Python embutido não encontrado.");
            }
            app.manage(AppState {
                db: Mutex::new(conn),
                http,
                ai: tokio::sync::Mutex::new(None),
                ai_python,
                ai_daemon_script,
                tts_model,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_ui_config,
            set_ui_lang,
            get_prefs,
            set_pref,
            get_cache_stats,
            clear_cache,
            db_status,
            wiki_search,
            wiki_autocomplete,
            wiki_open_article,
            get_reading_context,
            get_paragraph_nikud,
            get_paragraph_audio,
            get_word_audio,
            get_word_translation,
            add_learned_word,
            get_flashcards,
            get_word_image,
            mark_word,
            set_progress,
            get_reading_history,
            delete_article
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
