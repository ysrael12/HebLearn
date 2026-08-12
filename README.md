# Aprendiz de Hebraico (heblearn)

A desktop app for learning Hebrew by reading real **Wikipedia articles in Hebrew with nikud** (vowel marks), with text-to-speech, word-level translation, and spaced-repetition flashcards.

Built with **Tauri v2** (Rust backend) + **React 19 / TypeScript / Vite** frontend. Works fully offline after the first article download, with no Python installation required.

## Features

- **Search Wikipedia (Hebrew)** — search with autocomplete, pick an article, and read it paragraph by paragraph.
- **Nikud on demand** — every paragraph is diacritized with vowel marks using a local `nakdimon` model (offline, no API key).
- **Text-to-speech** — listen to whole paragraphs or individual words with a built-in Piper Hebrew voice (`he_IL-saspeech-medium`), speed adjustable from 0.5× to 2.0×.
- **Word translation (hover)** — click any word to hear it, translate it (LibreTranslate with MyMemory fallback), and save it as a flashcard.
- **Flashcards** — per-paragraph keyword cards with images from Wikimedia Commons, "learned / review" tracking, and a configurable per-paragraph card limit.
- **Reading progress** — progress is saved automatically; "Continue Reading" resumes where you left off.
- **Settings** — font size (small/medium/large), theme (light/dark/auto), TTS speed, voice selection (currently `default` only), automatic translation toggle, study mode (full / reading only), flashcards per paragraph, cache statistics, and cache clearing.
- **i18n** — UI in Portuguese (pt-BR), English, and Spanish; the selected language also drives article search, translation, and image lookup.
- **Onboarding** — first-run language selection screen.

## Status

Implemented and verified specs: **01** (onboarding/welcome), **02** (search), **03** (nikud reading), **04** (hover translation), **05** (flashcards), **06** (paragraph navigation), **07** (continue reading), **08** (settings), **11** (i18n).

| Spec | Feature | Status |
| --- | --- | --- |
| 01 | Initialization / welcome screen | ✅ |
| 02 | Article search | ✅ |
| 03 | Reading with nikud | ✅ |
| 04 | Hover translation | ✅ |
| 05 | Flashcards | ✅ |
| 06 | Paragraph navigation | ✅ |
| 07 | Continue reading | ✅ |
| 08 | Settings | ✅ |
| 09 | Statistics | 🚧 placeholder screen |
| 10 | Cache limits / LRU | ⏳ planned |
| 11 | Internationalization | ✅ |

Each spec lives in [`specs/`](specs/) with requirements (`FR-*`), UI (`UI-*`), data (`DR-*`), and error (`ER-*`) IDs; `proposta_produto.md` is the technical proposal.

## Tech stack

| Layer | Tech |
| --- | --- |
| Shell | Tauri v2 (Rust) |
| Backend | Rust — `rusqlite` (SQLite, bundled), `reqwest` 0.13, `tokio`, `serde`, `sha2`, `base64`, `chrono` |
| Frontend | React 19 + TypeScript + Vite 7 |
| AI runtime | Embedded Python 3.14 + `nakdimon` (nikud) + `piper-tts` (speech), shipped as app resources |
| Data | SQLite in the app data dir (WAL mode) — articles, nikud/audio/translation/image caches, progress, config |

### How the AI runtime works

Nikud and TTS models load **once per process** into a persistent Python daemon spawned by the Rust backend — no per-paragraph subprocess, no user Python install. The daemon speaks JSON lines with base64 payloads over stdio:

```json
{"op": "nikud", "text": "<base64>"}
{"op": "tts", "text": "<base64>"}
```

`nakdimon` is slow (~10 s per inference) and rejects pre-voweled text, so the daemon strips nikud before diacritizing and caches results in SQLite (`nikud_cache`, `audio_cache`, `translation_cache`, `image_cache`).

## Requirements

- **Node.js 20+** (Vite 7)
- **Rust toolchain** (stable) — [rustup](https://rustup.rs/)
- **Windows:** WebView2 runtime (preinstalled on Windows 10/11) + Visual Studio Build Tools (C++ workload)
- The embedded AI runtime adds ~1–2 GB of resources. The app targets machines with **4 GB RAM**: everything is processed on demand, per paragraph.

## Getting started

```bash
# install frontend deps
npm install

# run in dev mode (Vite on :1420, Tauri window opens)
npm run tauri dev

# type-check + build the frontend only
npm run build

# check / build the Rust backend (run from src-tauri/)
cd src-tauri && cargo check && cargo build

# build a distributable bundle
npm run tauri build
```

> **Windows note:** `npm run build` can produce an empty "Error: (none)" output; redirect to a log file to inspect the result: `npm run build > build.log 2>&1`.

## Project structure

```
├── specs/                      # feature specs (01–11)
├── proposta_produto.md         # technical proposal (architecture, schema)
├── src/                        # React frontend
│   ├── App.tsx                 # view router + app shell (sidebar + main)
│   ├── api.ts                  # typed invoke() wrappers
│   ├── types.ts                # shared types (mirror the Rust structs)
│   ├── i18n.tsx                # pt-BR / en / es dictionaries + provider
│   ├── settings.tsx            # prefs provider (font/theme/tts/…, optimistic)
│   ├── screens/                # Search, Reading, Flashcards, Welcome, Stats, SettingsModal, Sidebar, Language
│   └── App.css                 # theming via CSS variables (light/dark/auto)
└── src-tauri/                  # Rust backend
    ├── src/lib.rs              # Tauri entry, command list (invoke_handler)
    ├── src/db.rs               # full SQLite schema + auto-migration
    ├── src/wikipedia.rs        # MediaWiki client (search, autocomplete, pt→he langlink)
    ├── src/ai.rs               # persistent Python daemon (nikud + TTS)
    ├── src/translation.rs      # he→UI-lang translation (LibreTranslate → MyMemory)
    ├── src/keywords.rs         # flashcard keyword extraction (niqqud + stopwords)
    ├── src/images.rs           # Wikimedia Commons image lookup
    └── resources/              # embedded python-embed + nakdimon + piper voice
```

## Architecture notes

- **Tauri commands** are declared in `invoke_handler` in `src-tauri/src/lib.rs`; Rust `snake_case` params become `camelCase` on the JS side (`pt_title` → `ptTitle`).
- **SQLite access** uses `Mutex<Connection>` — always `.lock()` *after* `.await` points; never hold the lock across an await.
- **Translations** go to a local LibreTranslate instance (`http://localhost:5000` by default) with an automatic MyMemory fallback, since no Argos he→pt model exists.
- **Target-language setting** (Spec 08) is intentionally read-only and follows the UI language, so translation and search always match the configured language.
- **`reqwest 0.13`** split features: `.query()` needs the `query` feature, `.json()` needs `json` (both already enabled in `Cargo.toml` — do not remove).

## Roadmap

- Spec 09 — real statistics screen (currently a placeholder).
- Spec 10 — cache size limits / LRU eviction (clearing already exists).

## License

Not yet defined.
