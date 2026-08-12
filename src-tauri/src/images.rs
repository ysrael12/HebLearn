/// Busca de imagem ilustrativa por palavra (Spec 05).
/// Fonte padrão: API da Wikimedia Commons (gratuita, sem chave).
/// Config `os_url` (OpenSERP) tem prioridade quando definida.
use reqwest::Url;

const COMMONS_API: &str = "https://commons.wikimedia.org/w/api.php";

/// Termos cujos resultados devem ser evitados (conteúdo sensível/incômodo).
const BLOCKED_TERMS: &[&str] = &[
    "nazi", "swastika", "hakenkreuz", "holocaust", "auschwitz", "hitler",
    "gestapo", "wehrmacht", "krieg", "reich", "konzentrationslager",
];

fn is_blocked(title: &str) -> bool {
    let t = title.to_lowercase();
    BLOCKED_TERMS.iter().any(|term| t.contains(term))
}

/// Busca uma URL de imagem (thumbnail ~400px) para `query`.
/// Retorna `Ok(String::new())` se nenhuma imagem for encontrada.
pub async fn search_image(
    http: &reqwest::Client,
    query: &str,
) -> Result<String, String> {
    let url = Url::parse_with_params(
        COMMONS_API,
        &[
            ("action", "query"),
            ("generator", "search"),
            ("gsrsearch", query),
            ("gsrnamespace", "6"),
            ("gsrlimit", "8"),
            ("prop", "imageinfo"),
            ("iiprop", "url|mime"),
            ("iiurlwidth", "400"),
            ("format", "json"),
        ],
    )
    .map_err(|_| "URL inválida do serviço de imagens.".to_string())?;

    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Serviço de imagens indisponível. ({e})"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Serviço de imagens retornou erro {}.",
            resp.status().as_u16()
        ));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| "Resposta inválida do serviço de imagens.".to_string())?;

    let pages = json["query"]["pages"].as_object().cloned().unwrap_or_default();
    for page in pages.values() {
        let title = page["title"].as_str().unwrap_or("");
        if is_blocked(title) {
            continue;
        }
        let info = page["imageinfo"].as_array().cloned().unwrap_or_default();
        if let Some(ii) = info.first() {
            let mime = ii["mime"].as_str().unwrap_or("");
            if mime.starts_with("image/") {
                if let Some(thumb) = ii["thumburl"].as_str() {
                    return Ok(thumb.to_string());
                }
                if let Some(url) = ii["url"].as_str() {
                    return Ok(url.to_string());
                }
            }
        }
    }
    Ok(String::new())
}
