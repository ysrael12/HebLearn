# AGENTS.md

Aplicativo desktop **"Aprendiz de Hebraico"** (crate `heblearn`): leitura de artigos da Wikipédia em hebraico com nikud, TTS, tradução e flashcards. Tauri v2 + Rust backend + React 19/TS/Vite. Idioma do projeto: PT-BR (docs, UI, mensagens de erro).

## Comandos

- Dev: `npm run tauri dev` (Vite na porta 1420; janela Tauri abre)
- Frontend typecheck + build: `npm run build` (`tsc && vite build`)
- Rust: rode **com workdir `src-tauri/`**: `cargo check` / `cargo build`
- Não há testes, lint nem CI ainda.

## Arquitetura

- `src-tauri/src/lib.rs` — entrada Tauri; `AppState { db: Mutex<Connection>, http: reqwest::Client, ai: Mutex<Option<AiDaemon>>, ai_python, ai_daemon_script, tts_model }`; lista de comandos no `invoke_handler` (registre comandos novos lá).
- `src-tauri/src/db.rs` — schema SQLite completo (todas as tabelas dos specs) + migração automática em `db::open`. Banco em `app_data_dir`, WAL.
- `src-tauri/src/wikipedia.rs` — cliente MediaWiki (busca, autocomplete, langlink pt→he, extrato he → parágrafos).
- `src-tauri/src/ai.rs` — **daemon Python persistente** (`AiDaemon`) que mantém nakdimon (nikud) e piper-tts (TTS) carregados. Protocolo: linhas JSON ASCII com payload base64 (`{"op":"nikud"|"tts","text":"<b64>"}`). `text_hash` = SHA-256 (chave do `audio_cache`).
- `src-tauri/src/translation.rs` — tradução he→pt: LibreTranslate (`lt_url`, padrão `http://localhost:5000`) com **fallback MyMemory** (`api.mymemory.translated.net`, já que não existe modelo Argos he→pt).
- `src-tauri/src/keywords.rs` — extração de palavras-chave (Spec 05): remove niqqud, stopwords hebraicas e prefixos conectores (ו/ב/ה/ל/כ, com mínimo de 3 letras restantes).
- `src-tauri/src/images.rs` — busca de imagem por palavra via **Wikimedia Commons** (gratuito, sem chave); config `os_url` (OpenSERP) teria prioridade se definida.
- Runtime embutido (não depende de Python do usuário): `src-tauri/resources/nikud/python/` (python-embed + nakdimon + onnxruntime + piper-tts) e `src-tauri/resources/tts/he_IL-saspeech-medium.onnx`. Caminhos resolvidos em `resolve_ai_runtime` (produção usa `resource_dir`; dev usa `CARGO_MANIFEST_DIR`).
- `src/App.tsx` — layout `app-shell` com sidebar (histórico/Continuar Leitura) + main; router por estado (`view: "search" | "reading"`); `ReadingScreen` recebe `key={article_id}` (remonta ao trocar de artigo).
- `src/api.ts` — wrappers `invoke`; `src/types.ts` — tipos compartilhados (espelham as structs Rust).
- Frontend: `ReadingScreen` mostra **apenas o parágrafo atual**; palavras clicáveis abrem popover com "Ouvir" e "Traduzir" (+ "Adicionar aos Flashcards").

## Comandos Tauri (Spec 03/04/07)

- `get_reading_context(articleId)` — artigo + parágrafos + progresso.
- `get_paragraph_nikud(articleId, paragraphIndex)` — nikud com cache (`nikud_cache`).
- `get_paragraph_audio(articleId, paragraphIndex)` — TTS do parágrafo com cache (`audio_cache`); usa texto com nikud quando disponível.
- `get_word_audio(word)` — TTS de palavra isolada (mesmo cache).
- `get_word_translation(word)` — tradução he→pt com cache (`translation_cache`).
- `add_learned_word(wordHe, wordPt)` — insere em `learned_words` sem duplicar.
- `set_progress(articleId, paragraphIndex)` — atualiza `user_progress`.
- `get_reading_history()` — artigos + progresso para a sidebar.
- `get_flashcards(articleId, paragraphIndex)` — palavras-chave do parágrafo + estado em `learned_words`.
- `get_word_image(word)` — imagem ilustrativa com cache (`image_cache`).
- `mark_word(wordHe, learned)` — marca aprendida (learned=true) ou para revisão (learned=false).

## Gotchas verificados

- **reqwest 0.13** dividiu features: `.query()` exige feature `query`, `.json()` exige `json` (ambos já ativos no Cargo.toml; não remover).
- **Tauri invoke**: parâmetros Rust `snake_case` viram `camelCase` no JS (`pt_title` → `ptTitle`).
- **MediaWiki `formatversion=2`**: `langlinks[]` usa campo `title` (não `*`); `query.pages` é array. Extratos completos de `he.wikipedia.org` são grandes (~165KB) — baixar 1x e salvar no SQLite, nunca manter inteiro na UI.
- **`AppState.db` é `Mutex<Connection>`**: faça `.lock()` *depois* dos `.await` (padrão em `wiki_open_article`); não segure o lock em `async`.
- **nakdimon rejeita texto já pontuado** (`assert letter not in ANY_NIQQUD`): o daemon faz `strip_niqqud` (remove U+0591–U+05C7) antes de diacritizar. Artigos da Wikipédia hebraica às vezes têm texto com vogais.
- **nakdimon é lento (~10s fixos por inferência, entrada `(1, 10000)`)** e o modelo carrega 1x por processo — por isso o **daemon persistente** em vez de subprocesso por parágrafo.
- **piper-tts 1.6.0**: `synthesize_wav(text, wav_file, SynthesisConfig)` precisa de objeto `wave` (não BytesIO cru). Velocidade controlada por `SynthesisConfig(length_scale)` — 1.5 ≈ ritmo lento de aprendizagem.
- **Timeout do daemon é por operação**: nikud 60s, TTS 300s (parágrafos longos geram áudio de minutos; timeout curto quebrava o botão de áudio).
- **Mutex no daemon de IA** (`state.ai`): usar `tokio::sync::Mutex`, lock via `.lock().await`. Ao falhar, derrubar (`*guard = None`) para reiniciar na próxima chamada.
- **Python embed (Windows)**: `python314._pth` precisa conter `site-packages` + `import site`. `site-packages` instalado com `pip install --target`. Teste de protocolo: usar `PYTHONIOENCODING=utf-8` e escrever em arquivo UTF-8 (console cp1252 não imprime hebraico).
- Foco em máquinas com 4GB de RAM: processar sob demanda por parágrafo (Nikud/TTS), usar caches do SQLite, não carregar artigos inteiros no frontend.
- Smoke test no Windows: `npm` é shim `.cmd`; para `Start-Process` use `npm.cmd`. Encerre processos `heblearn.exe`/node órfãos após o teste.
- README.md é o template padrão do scaffold (sem informação útil).

## Fonte de verdade para features

- `proposta_produto.md` — proposta técnica (arquitetura, schema, decisões).
- `specs/01-10-*.md` — specs por funcionalidade com IDs `FR-<NN>-XX`, `UI-<NN>-XX`, `DR-<NN>-XX`, `ER-<NN>-XX`. Cada spec lista o que implementar (requisitos), UI, dados, erros e critérios de aceite.
