# Spec 11 — Internacionalização (i18n) e Configuração Inicial de Idioma

## 1. Objetivo

Internacionalizar a aplicação: todo texto da UI passa a ser gerenciado por um sistema de tradução (dicionários por idioma), e na primeira execução o usuário define o idioma em uma tela de configuração inicial (onboarding) antes de acessar a aplicação.

**Escopo:** o idioma configurado (`ui_lang`) dirige a **interface**, a **busca de artigos** (Wikipédia do idioma) e a **tradução** das palavras (he → idioma configurado, usado também nos flashcards). O idioma de **aprendizagem é fixo: hebraico** — o conteúdo lido, o nikud, o TTS e as palavras-chave não mudam de idioma.

## 2. Pré-requisitos

- Aplicação inicializa com banco SQLite pronto (Spec 01).
- Não há `ui_lang` definido em `app_config` (primeira execução) → fluxo de onboarding.

## 3. Fluxo Principal

1. Usuário abre o aplicativo pela primeira vez.
2. O backend detecta que `app_config` não contém `ui_lang` → frontend exibe a **Tela de Configuração Inicial** (antes da Tela de Boas-Vindas).
3. A tela apresenta a seleção de idioma da interface (ex.: Português, English, Español) com preview do texto no idioma selecionado.
4. Usuário escolhe o idioma → `set_ui_lang` persiste em `app_config` → dicionário ativo é trocado instantaneamente → aplicativo navega para a Tela de Boas-Vindas (Spec 01).
5. Nas execuções seguintes, a Tela de Configuração Inicial **não** é exibida; a UI carrega com o idioma salvo.
6. Em qualquer tela, "Configurações" (Spec 08) permite trocar o idioma da interface a qualquer momento.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-11-01 | Detectar primeira execução: é considerada primeira execução quando `app_config` não possui a chave `ui_lang`. |
| FR-11-02 | Exibir a Tela de Configuração Inicial apenas na primeira execução, antes da Tela de Boas-Vindas. |
| FR-11-03 | Permitir selecionar o idioma da interface entre os idiomas suportados (mínimo: `pt-BR` — padrão, `en`, `es`). |
| FR-11-04 | Persistir o idioma escolhido em `app_config` (chave `ui_lang`, valor BCP-47, ex.: `pt-BR`, `en`, `es`). |
| FR-11-05 | Aplicar o idioma selecionado instantaneamente (sem reiniciar a aplicação) ao confirmar na tela inicial. |
| FR-11-06 | Carregar o idioma salvo (`ui_lang`) na inicialização das execuções seguintes. |
| FR-11-07 | Trocar o idioma pelo seletor da sidebar (e futuramente pelo modal da Spec 08) em qualquer momento, com aplicação em tempo real. |
| FR-11-08 | Dirigir a busca de artigos pelo idioma configurado: a busca e o autocomplete consultam a Wikipédia do idioma (`pt`/`en`/`es`), e a resolução do título hebraico (langlinks) parte dessa wiki. |
| FR-11-09 | Dirigir a tradução pelo idioma configurado: `get_word_translation` traduz he → idioma configurado (LibreTranslate/MyMemory com `langpair` he\|{idioma}); os flashcards exibem a tradução no idioma configurado. |
| FR-11-10 | Manter o idioma de aprendizagem fixo em hebraico: texto dos artigos, nikud, TTS e o layout RTL do conteúdo hebraico **não** são afetados pela troca de idioma. |
| FR-11-11 | Definir `lang` e `dir` no HTML: documento em `ui_lang`; blocos de conteúdo hebraico permanecem com `lang="he" dir="rtl"` (como já implementado). |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-11-01 | Tela de Configuração Inicial: logotipo, título "Escolha o idioma" e seletor dos idiomas suportados em cards/radio. |
| UI-11-02 | Cada opção de idioma exibe o nome no próprio idioma (ex.: "Português", "English", "Español") e um preview curto do texto da UI no idioma correspondente. |
| UI-11-03 | Botão "Continuar" desabilitado até um idioma ser selecionado; ao confirmar, aplicar idioma e navegar para a Tela de Boas-Vindas. |
| UI-11-04 | No modal de Configurações (Spec 08), nova seção/seletor "Idioma da interface" com as mesmas opções; troca aplicada em tempo real. |
| UI-11-05 | Todo texto de UI (botões, títulos, mensagens de erro, tooltips, confirmações) passa a ser carregado do dicionário ativo; nenhum string fixo em português deve restar no código do frontend. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-11-01 | Chave `ui_lang` em `app_config` (tabela já existente, ver `db.rs`), valor BCP-47. Ausência da chave = primeira execução. |
| DR-11-02 | Backend expõe comando para ler estado de i18n: retorna `{ ui_lang, first_run }` (ex.: `get_ui_config`). |
| DR-11-03 | Backend expõe comando para gravar idioma: `set_ui_lang(uiLang)` → `db::set_config("ui_lang", value)` (funções `db::get_config`/`db::set_config` já existem). |
| DR-11-04 | Dicionários de tradução versionados no frontend (ex.: `src/i18n/{pt-BR,en,es}.ts`) com a mesma estrutura de chaves; chave ausente em idioma não padrão faz fallback para `pt-BR` (idioma padrão). |
| DR-11-05 | Comandos de busca (`wiki_search`, `wiki_autocomplete`, `wiki_open_article`) e tradução (`get_word_translation`, `get_word_image`) recebem `ui_lang`; backend mapeia para código de wiki e código de tradução (`pt-BR`→`pt`, `en`→`en`, `es`→`es`). |
| DR-11-06 | Cache de tradução por idioma: `translation_cache` já tem `target_lang` na UNIQUE(`source_text`, `source_lang`, `target_lang`); consulta/gravação usam o idioma configurado. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-11-01 | Falha ao persistir `ui_lang` | Exibir aviso na tela de configuração inicial; manter seleção e permitir nova tentativa. |
| ER-11-02 | `ui_lang` salvo com valor não suportado (ex.: banco editado) | Fazer fallback para `pt-BR` e reescrever a chave; não bloquear a inicialização. |
| ER-11-03 | Falha ao carregar dicionário | Fallback para dicionário `pt-BR`; logs no console (frontend). |

## 8. Critérios de Aceite

- [ ] Na primeira execução, a Tela de Configuração Inicial aparece antes da Tela de Boas-Vindas; nas execuções seguintes, não.
- [ ] Escolher idioma na tela inicial aplica a troca imediatamente e persiste (`ui_lang` gravado em `app_config`).
- [ ] Trocar idioma no seletor da sidebar reflete em toda a UI sem reiniciar.
- [ ] A busca e o autocomplete consultam a Wikipédia do idioma configurado (pt/en/es) e o artigo é aberto via langlink para o hebraico.
- [ ] Tradução de palavras e de flashcards é he → idioma configurado; trocar o idioma re-traduz (cache por `target_lang`).
- [ ] Texto dos artigos em hebraico (nikud, RTL) permanece inalterado em qualquer idioma.
- [ ] Não há strings fixos em português no código do frontend (todos migrados para dicionários).

## 9. Dependências

- Backend Rust (Tauri): comandos `get_ui_config`/`set_ui_lang` usando `db::get_config`/`db::set_config` (registrar no `invoke_handler` de `lib.rs`).
- Frontend React: provider de i18n leve (dicionários + função `t()`, sem biblioteca externa — adicionar `i18next` somente se a demanda de idiomas crescer), seção no modal da Spec 08, tela de onboarding integrada ao fluxo da Spec 01.
- Não interfere em: Spec 04 (tradução de palavras), Spec 05 (flashcards), Spec 06 (avançar parágrafo), Spec 07 (continuar leitura).
