use serde::{Deserialize, Serialize};

const HE_WIKI: &str = "https://he.wikipedia.org/w/api.php";

/// URL da API da Wikipédia no idioma configurado (ex.: `pt`, `en`, `es`).
fn wiki_api_url(lang: &str) -> String {
    format!("https://{lang}.wikipedia.org/w/api.php")
}

#[derive(Debug, Clone, Serialize)]
pub struct ArticlePreview {
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
struct ApiResponse {
    query: Option<Query>,
    error: Option<ApiError>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    code: String,
    info: String,
}

#[derive(Debug, Deserialize)]
struct Query {
    #[serde(default)]
    pages: Option<Vec<Page>>,
    #[serde(default)]
    prefixsearch: Option<Vec<PrefixHit>>,
    #[serde(default)]
    search: Option<Vec<SearchHit>>,
}

#[derive(Debug, Deserialize)]
struct Page {
    title: String,
    #[serde(default)]
    extract: Option<String>,
    #[serde(default)]
    langlinks: Option<Vec<LangLink>>,
}

#[derive(Debug, Deserialize)]
struct PrefixHit {
    title: String,
}

#[derive(Debug, Deserialize)]
struct SearchHit {
    title: String,
}

#[derive(Debug, Deserialize)]
struct LangLink {
    lang: String,
    title: String,
}

fn user_agent() -> &'static str {
    "Heblearn/0.1 (Aprendiz de Hebraico; Tauri desktop app)"
}

fn check_error(resp: &ApiResponse) -> Result<(), String> {
    if let Some(err) = &resp.error {
        return Err(format!("erro da API Wikipédia: {} ({})", err.info, err.code));
    }
    Ok(())
}

async fn send(client: &reqwest::Client, url: &str, params: &[(&str, &str)]) -> Result<ApiResponse, String> {
    client
        .get(url)
        .header("User-Agent", user_agent())
        .query(params)
        .send()
        .await
        .map_err(|e| format!("Não foi possível conectar à Wikipédia. Verifique sua conexão com a internet. ({e})"))?
        .json()
        .await
        .map_err(|e| format!("Resposta inválida da Wikipédia: {e}"))
}

/// Busca artigos na Wikipédia do idioma configurado com resumo do primeiro parágrafo.
pub async fn search(
    client: &reqwest::Client,
    lang: &str,
    term: &str,
) -> Result<Vec<ArticlePreview>, String> {
    let resp = send(
        client,
        &wiki_api_url(lang),
        &[
            ("action", "query"),
            ("generator", "search"),
            ("gsrsearch", term),
            ("gsrlimit", "10"),
            ("prop", "extracts"),
            ("exintro", "1"),
            ("explaintext", "1"),
            ("exlimit", "max"),
            ("redirects", "1"),
            ("format", "json"),
            ("formatversion", "2"),
        ],
    )
    .await?;
    check_error(&resp)?;

    let mut out = Vec::new();
    if let Some(query) = &resp.query {
        if let Some(pages) = &query.pages {
            for page in pages {
                out.push(ArticlePreview {
                    title: page.title.clone(),
                    summary: page.extract.clone().unwrap_or_default(),
                });
            }
        }
    }
    if out.is_empty() {
        return Err(
            "Nenhum artigo encontrado neste idioma com este termo. Tente uma nova busca.".to_string(),
        );
    }
    Ok(out)
}

/// Sugestões de títulos conforme a digitação (prefixsearch), no idioma configurado.
pub async fn autocomplete(
    client: &reqwest::Client,
    lang: &str,
    term: &str,
) -> Result<Vec<String>, String> {
    if term.trim().is_empty() {
        return Ok(Vec::new());
    }
    let resp = send(
        client,
        &wiki_api_url(lang),
        &[
            ("action", "query"),
            ("list", "prefixsearch"),
            ("pssearch", term),
            ("pslimit", "8"),
            ("format", "json"),
            ("formatversion", "2"),
        ],
    )
    .await?;
    check_error(&resp)?;

    let mut titles = Vec::new();
    if let Some(query) = &resp.query {
        if let Some(hits) = &query.prefixsearch {
            titles.extend(hits.iter().map(|h| h.title.clone()));
        }
    }
    Ok(titles)
}

/// Resolve o título do artigo em hebraico via interwiki (langlinks) a partir
/// da Wikipédia do idioma configurado. Se não houver correspondência, busca
/// na Wikipédia hebraica pelo termo.
pub async fn resolve_he_title(
    client: &reqwest::Client,
    lang: &str,
    source_title: &str,
) -> Result<String, String> {
    if let Some(he) = langlink(client, lang, source_title).await? {
        return Ok(he);
    }
    let titles = he_search_titles(client, source_title).await?;
    if let Some(t) = titles.into_iter().next() {
        return Ok(t);
    }
    Err(
        "Versão em hebraico não encontrada para este artigo. Tente buscar diretamente por outro título."
            .to_string(),
    )
}

async fn langlink(
    client: &reqwest::Client,
    lang: &str,
    source_title: &str,
) -> Result<Option<String>, String> {
    let resp = send(
        client,
        &wiki_api_url(lang),
        &[
            ("action", "query"),
            ("prop", "langlinks"),
            ("lllang", "he"),
            ("lllimit", "5"),
            ("titles", source_title),
            ("redirects", "1"),
            ("format", "json"),
            ("formatversion", "2"),
        ],
    )
    .await?;
    check_error(&resp)?;

    if let Some(query) = &resp.query {
        if let Some(pages) = &query.pages {
            for page in pages {
                if let Some(links) = &page.langlinks {
                    for link in links {
                        if link.lang == "he" {
                            return Ok(Some(link.title.clone()));
                        }
                    }
                }
            }
        }
    }
    Ok(None)
}

async fn he_search_titles(client: &reqwest::Client, term: &str) -> Result<Vec<String>, String> {
    let resp = send(
        client,
        HE_WIKI,
        &[
            ("action", "query"),
            ("list", "search"),
            ("srsearch", term),
            ("srlimit", "10"),
            ("format", "json"),
            ("formatversion", "2"),
        ],
    )
    .await?;
    check_error(&resp)?;

    let mut titles = Vec::new();
    if let Some(query) = &resp.query {
        if let Some(hits) = &query.search {
            titles.extend(hits.iter().map(|h| h.title.clone()));
        }
    }
    Ok(titles)
}

/// Baixa o texto completo do artigo em hebraico e o divide em parágrafos.
pub async fn fetch_paragraphs(client: &reqwest::Client, he_title: &str) -> Result<Vec<String>, String> {
    let resp = send(
        client,
        HE_WIKI,
        &[
            ("action", "query"),
            ("prop", "extracts"),
            ("explaintext", "1"),
            ("exlimit", "max"),
            ("redirects", "1"),
            ("titles", he_title),
            ("format", "json"),
            ("formatversion", "2"),
        ],
    )
    .await?;
    check_error(&resp)?;

    if let Some(query) = &resp.query {
        if let Some(pages) = &query.pages {
            if let Some(page) = pages.first() {
                if let Some(text) = &page.extract {
                    if text.trim().is_empty() {
                        return Err("O artigo em hebraico não possui conteúdo.".to_string());
                    }
                    return Ok(split_paragraphs(text));
                }
            }
        }
    }
    Err("Não foi possível baixar o conteúdo do artigo em hebraico.".to_string())
}

pub fn article_url(he_title: &str) -> String {
    format!("https://he.wikipedia.org/wiki/{}", he_title.replace(' ', "_"))
}

fn split_paragraphs(text: &str) -> Vec<String> {
    let double: Vec<String> = text
        .split("\n\n")
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();
    if double.len() > 1 {
        return double;
    }
    text.lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect()
}
