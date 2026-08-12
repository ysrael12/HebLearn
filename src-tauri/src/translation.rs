/// Tradução hebraico → idioma configurado (Spec 04/11).
/// 1) Tenta LibreTranslate local (config `lt_url`); se indisponível ou sem o
///    par he→{target}, cai no MyMemory (gratuito, suporta he|pt/en/es).
use reqwest::Url;
use serde::Serialize;

const DEFAULT_LT_URL: &str = "http://localhost:5000";
const MYMEMORY_URL: &str = "https://api.mymemory.translated.net/get";

#[derive(Serialize)]
struct TranslateRequest<'a> {
    q: &'a str,
    source: &'a str,
    target: &'a str,
    format: &'a str,
}

/// URL do LibreTranslate a partir da configuração (ou padrão local).
pub fn lt_url(config_url: Option<String>) -> String {
    config_url.unwrap_or_else(|| DEFAULT_LT_URL.to_string())
}

/// Traduz `word` de hebraico para o idioma `target` (ex.: "pt", "en", "es").
pub async fn translate(
    http: &reqwest::Client,
    base_url: &str,
    word: &str,
    target: &str,
) -> Result<String, String> {
    match libretranslate(http, base_url, word, target).await {
        Ok(t) => Ok(t),
        Err(_) => mymemory(http, word, target).await,
    }
}

async fn libretranslate(
    http: &reqwest::Client,
    base_url: &str,
    word: &str,
    target: &str,
) -> Result<String, String> {
    let url = format!("{}/translate", base_url.trim_end_matches('/'));
    let body = TranslateRequest {
        q: word,
        source: "he",
        target,
        format: "text",
    };

    let resp = http
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Serviço de tradução indisponível no momento. ({e})"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Serviço de tradução retornou erro {}.",
            resp.status().as_u16()
        ));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| "Resposta inválida do serviço de tradução.".to_string())?;

    let text = json["translatedText"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Tradução não disponível.".to_string())?;

    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("Tradução não disponível.".to_string());
    }
    Ok(text)
}

async fn mymemory(http: &reqwest::Client, word: &str, target: &str) -> Result<String, String> {
    let url = Url::parse_with_params(
        MYMEMORY_URL,
        &[("q", word), ("langpair", format!("he|{target}").as_str())],
    )
    .map_err(|_| "URL inválida do serviço de tradução.".to_string())?;

    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Serviço de tradução indisponível no momento. ({e})"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Serviço de tradução retornou erro {}.",
            resp.status().as_u16()
        ));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| "Resposta inválida do serviço de tradução.".to_string())?;

    let status = json["responseStatus"].as_i64().unwrap_or(0);
    let text = json["responseData"]["translatedText"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let text = text.trim().to_string();

    if status != 200
        || text.is_empty()
        || text.contains("MYMEMORY WARNING")
        || text.contains("INVALID QUERY")
    {
        return Err("Tradução não disponível.".to_string());
    }
    Ok(text)
}
