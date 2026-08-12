use rusqlite::{params, Connection};
use std::path::Path;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_he TEXT NOT NULL,
    title_pt TEXT NOT NULL,
    url TEXT NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paragraphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    paragraph_index INTEGER NOT NULL,
    content_he TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    UNIQUE (article_id, paragraph_index)
);

CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    current_paragraph_index INTEGER DEFAULT 0,
    total_paragraphs INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS nikud_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL UNIQUE,
    nikud_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_hash TEXT NOT NULL UNIQUE,
    audio_data BLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS translation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT NOT NULL,
    source_lang TEXT NOT NULL DEFAULT 'he',
    target_lang TEXT NOT NULL DEFAULT 'pt',
    translated_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_text, source_lang, target_lang)
);

CREATE TABLE IF NOT EXISTS image_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL UNIQUE,
    image_urls TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learned_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_he TEXT NOT NULL,
    word_pt TEXT NOT NULL,
    learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    paragraphs_read INTEGER DEFAULT 0,
    words_clicked INTEGER DEFAULT 0,
    translations_requested INTEGER DEFAULT 0,
    audio_plays INTEGER DEFAULT 0,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    correct BOOLEAN NOT NULL,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES learned_words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_article ON user_progress(article_id);
CREATE INDEX IF NOT EXISTS idx_nikud_original ON nikud_cache(original_text);
CREATE INDEX IF NOT EXISTS idx_audio_hash ON audio_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_paragraphs_article ON paragraphs(article_id);
CREATE INDEX IF NOT EXISTS idx_review_word ON review_history(word_id);
"#;

/// Opens (or creates) the SQLite database at `app_data_dir/heblearn.db`,
/// enables WAL mode and applies the schema migrations.
pub fn open(app_data_dir: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(app_data_dir)?;
    let conn = Connection::open(app_data_dir.join("heblearn.db"))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

/// Busca um artigo já salvo pelo título em hebraico (evita duplicatas).
pub fn find_article_by_title_he(
    conn: &Connection,
    title_he: &str,
) -> rusqlite::Result<Option<i64>> {
    let mut stmt = conn.prepare("SELECT id FROM articles WHERE title_he = ?1")?;
    let mut rows = stmt.query([title_he])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

pub fn insert_article(
    conn: &Connection,
    title_he: &str,
    title_pt: &str,
    url: &str,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO articles (title_he, title_pt, url) VALUES (?1, ?2, ?3)",
        params![title_he, title_pt, url],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_paragraphs(
    conn: &Connection,
    article_id: i64,
    paragraphs: &[String],
) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO paragraphs (article_id, paragraph_index, content_he) VALUES (?1, ?2, ?3)",
    )?;
    for (i, p) in paragraphs.iter().enumerate() {
        stmt.execute(params![article_id, i as i64, p])?;
    }
    Ok(())
}

/// Substitui os parágrafos de um artigo já existente.
pub fn replace_paragraphs(
    conn: &Connection,
    article_id: i64,
    paragraphs: &[String],
) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM paragraphs WHERE article_id = ?1", [article_id])?;
    insert_paragraphs(conn, article_id, paragraphs)
}

/// Busca os dados básicos de um artigo pelo id.
pub fn get_article(
    conn: &Connection,
    article_id: i64,
) -> rusqlite::Result<Option<(String, String, String)>> {
    let mut stmt = conn.prepare("SELECT title_he, title_pt, url FROM articles WHERE id = ?1")?;
    let mut rows = stmt.query([article_id])?;
    match rows.next()? {
        Some(row) => Ok(Some((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
        ))),
        None => Ok(None),
    }
}

/// Retorna todos os parágrafos de um artigo em ordem de índice.
pub fn get_paragraphs(conn: &Connection, article_id: i64) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT content_he FROM paragraphs WHERE article_id = ?1 ORDER BY paragraph_index",
    )?;
    let rows = stmt.query_map([article_id], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// Retorna o texto do parágrafo `index` de um artigo.
pub fn get_paragraph(
    conn: &Connection,
    article_id: i64,
    paragraph_index: i64,
) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT content_he FROM paragraphs WHERE article_id = ?1 AND paragraph_index = ?2",
    )?;
    let mut rows = stmt.query(params![article_id, paragraph_index])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// Retorna o nikud em cache para um texto original, se existir.
pub fn get_nikud_cached(conn: &Connection, original_text: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn
        .prepare("SELECT nikud_text FROM nikud_cache WHERE original_text = ?1")?;
    let mut rows = stmt.query([original_text])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// Salva o resultado do nikud no cache (ignora se o texto já existir).
pub fn put_nikud_cache(
    conn: &Connection,
    original_text: &str,
    nikud_text: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO nikud_cache (original_text, nikud_text) VALUES (?1, ?2)",
        params![original_text, nikud_text],
    )?;
    Ok(())
}

/// Retorna o áudio em cache pelo hash do texto, se existir.
pub fn get_audio_cached(conn: &Connection, text_hash: &str) -> rusqlite::Result<Option<Vec<u8>>> {
    let mut stmt = conn.prepare("SELECT audio_data FROM audio_cache WHERE text_hash = ?1")?;
    let mut rows = stmt.query([text_hash])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// Salva o áudio no cache (ignora se o hash já existir).
pub fn put_audio_cache(
    conn: &Connection,
    text_hash: &str,
    audio_data: &[u8],
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO audio_cache (text_hash, audio_data) VALUES (?1, ?2)",
        params![text_hash, audio_data],
    )?;
    Ok(())
}

/// Retorna o progresso de leitura de um artigo, se existir.
pub fn get_user_progress(
    conn: &Connection,
    article_id: i64,
) -> rusqlite::Result<Option<(i64, i64, bool)>> {
    let mut stmt = conn.prepare(
        "SELECT current_paragraph_index, total_paragraphs, completed FROM user_progress WHERE article_id = ?1",
    )?;
    let mut rows = stmt.query([article_id])?;
    match rows.next()? {
        Some(row) => Ok(Some((row.get(0)?, row.get(1)?, row.get(2)?))),
        None => Ok(None),
    }
}

/// Atualiza o parágrafo atual (e marca como concluído se chegou ao último).
pub fn update_user_progress(
    conn: &Connection,
    article_id: i64,
    current_paragraph_index: i64,
    total_paragraphs: i64,
) -> rusqlite::Result<()> {
    let completed = current_paragraph_index >= total_paragraphs - 1 && total_paragraphs > 0;
    conn.execute(
        "UPDATE user_progress SET current_paragraph_index = ?2, total_paragraphs = ?3, completed = ?4, last_read = CURRENT_TIMESTAMP WHERE article_id = ?1",
        params![article_id, current_paragraph_index, total_paragraphs, completed],
    )?;
    Ok(())
}

/// Lê um valor de `app_config` (preferências do usuário / engine).
pub fn get_config(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_config WHERE key = ?1")?;
    let mut rows = stmt.query([key])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// Grava um valor em `app_config` (UPSERT).
pub fn set_config(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
        params![key, value],
    )?;
    Ok(())
}

/// Tradução em cache (he → `target_lang`) para uma palavra/texto, se existir.
pub fn get_translation_cached(
    conn: &Connection,
    source_text: &str,
    target_lang: &str,
) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT translated_text FROM translation_cache
         WHERE source_text = ?1 AND source_lang = 'he' AND target_lang = ?2",
    )?;
    let mut rows = stmt.query([source_text, target_lang])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}

/// Salva a tradução no cache por idioma (ignora se já existir).
pub fn put_translation_cache(
    conn: &Connection,
    source_text: &str,
    translated_text: &str,
    target_lang: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO translation_cache (source_text, source_lang, target_lang, translated_text)
         VALUES (?1, 'he', ?3, ?2)",
        params![source_text, translated_text, target_lang],
    )?;
    Ok(())
}

/// Verifica se a palavra já está em `learned_words`.
pub fn is_word_learned(conn: &Connection, word_he: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learned_words WHERE word_he = ?1",
        [word_he],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

/// Adiciona a palavra a `learned_words` sem duplicar (FR-04-06/07).
pub fn add_learned_word(
    conn: &Connection,
    word_he: &str,
    word_pt: &str,
) -> rusqlite::Result<bool> {
    let exists = is_word_learned(conn, word_he)?;
    if exists {
        return Ok(false);
    }
    conn.execute(
        "INSERT INTO learned_words (word_he, word_pt) VALUES (?1, ?2)",
        params![word_he, word_pt],
    )?;
    Ok(true)
}

/// Lista todas as palavras aprendidas (para checagem de pertinência).
pub fn get_learned_words(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT word_he FROM learned_words")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// Marca uma palavra como aprendida (learned=true) ou para revisão (learned=false).
/// Upsert em `learned_words` mantendo a tradução existente, se houver.
pub fn mark_word(conn: &Connection, word_he: &str, learned: bool) -> rusqlite::Result<()> {
    let review_count: i64 = if learned { 1 } else { 0 };
    let exists = is_word_learned(conn, word_he)?;
    if exists {
        conn.execute(
            "UPDATE learned_words SET review_count = ?2, learned_at = CURRENT_TIMESTAMP WHERE word_he = ?1",
            params![word_he, review_count],
        )?;
    } else {
        conn.execute(
            "INSERT INTO learned_words (word_he, word_pt, review_count) VALUES (?1, '', ?2)",
            params![word_he, review_count],
        )?;
    }
    Ok(())
}

/// Primeira URL de imagem em cache para um termo, se existir.
pub fn get_image_cached(conn: &Connection, query_text: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT image_urls FROM image_cache WHERE query_text = ?1")?;
    let mut rows = stmt.query([query_text])?;
    match rows.next()? {
        Some(row) => {
            let urls: String = row.get(0)?;
            let parsed: serde_json::Value = serde_json::from_str(&urls).unwrap_or_default();
            let first = parsed
                .as_array()
                .and_then(|a| a.first())
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();
            if first.is_empty() {
                Ok(None)
            } else {
                Ok(Some(first))
            }
        }
        None => Ok(None),
    }
}

/// Salva a lista de URLs de imagem no cache (ignora se o termo já existir).
pub fn put_image_cache(
    conn: &Connection,
    query_text: &str,
    urls: &[String],
) -> rusqlite::Result<()> {
    let json = serde_json::to_string(urls).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT OR IGNORE INTO image_cache (query_text, image_urls) VALUES (?1, ?2)",
        params![query_text, json],
    )?;
    Ok(())
}

/// Remove um artigo e seus dados relacionados (progresso e sessões).
/// Parágrafos são removidos via ON DELETE CASCADE.
pub fn delete_article(conn: &Connection, article_id: i64) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM user_progress WHERE article_id = ?1",
        [article_id],
    )?;
    conn.execute(
        "DELETE FROM study_sessions WHERE article_id = ?1",
        [article_id],
    )?;
    conn.execute("DELETE FROM articles WHERE id = ?1", [article_id])?;
    Ok(())
}

/// Lista os artigos já abertos com o progresso de leitura (para a sidebar).
/// Ordenados pelo mais recentemente lido.
pub fn get_reading_history(
    conn: &Connection,
) -> rusqlite::Result<Vec<(i64, String, String, i64, i64, bool)>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.title_he, a.title_pt, p.current_paragraph_index, p.total_paragraphs, p.completed
         FROM articles a
         LEFT JOIN user_progress p ON p.article_id = a.id
         ORDER BY COALESCE(p.last_read, a.fetched_at) DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get(0)?,
            r.get(1)?,
            r.get(2)?,
            r.get(3)?,
            r.get(4)?,
            r.get(5)?,
        ))
    })?;
    rows.collect()
}

/// Garante que existe um registro de progresso para o artigo (com total de parágrafos).
pub fn ensure_user_progress(
    conn: &Connection,
    article_id: i64,
    total_paragraphs: i64,
) -> rusqlite::Result<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM user_progress WHERE article_id = ?1",
        [article_id],
        |r| r.get(0),
    )?;
    if exists == 0 {
        conn.execute(
            "INSERT INTO user_progress (article_id, current_paragraph_index, total_paragraphs) VALUES (?1, 0, ?2)",
            params![article_id, total_paragraphs],
        )?;
    } else {
        conn.execute(
            "UPDATE user_progress SET total_paragraphs = ?2, last_read = CURRENT_TIMESTAMP WHERE article_id = ?1",
            params![article_id, total_paragraphs],
        )?;
    }
    Ok(())
}

/// Somatório do tamanho em bytes de cada cache (Spec 08 FR-08-09).
pub fn get_cache_stats(
    conn: &Connection,
) -> rusqlite::Result<(i64, i64, i64, i64)> {
    let nikud: i64 = conn.query_row(
        "SELECT COALESCE(SUM(LENGTH(nikud_text)), 0) FROM nikud_cache",
        [],
        |r| r.get(0),
    )?;
    let audio: i64 = conn.query_row(
        "SELECT COALESCE(SUM(LENGTH(audio_data)), 0) FROM audio_cache",
        [],
        |r| r.get(0),
    )?;
    let translations: i64 = conn.query_row(
        "SELECT COALESCE(SUM(LENGTH(translated_text)), 0) FROM translation_cache",
        [],
        |r| r.get(0),
    )?;
    let images: i64 = conn.query_row(
        "SELECT COALESCE(SUM(LENGTH(image_urls)), 0) FROM image_cache",
        [],
        |r| r.get(0),
    )?;
    Ok((nikud, audio, translations, images))
}

/// Apaga todos os caches de serviços (Spec 08 FR-08-10).
/// ponytail: a Spec 10 (limites de tamanho/LRU) é implementada quando vier;
/// hoje a limpeza é manual e total.
pub fn clear_cache(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM nikud_cache", [])?;
    conn.execute("DELETE FROM audio_cache", [])?;
    conn.execute("DELETE FROM translation_cache", [])?;
    conn.execute("DELETE FROM image_cache", [])?;
    Ok(())
}
