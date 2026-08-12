# Spec 03 — Leitura de Parágrafo com Nikud

## 1. Objetivo

Exibir o texto do artigo em hebraico parágrafo por parágrafo com **nikud** (vogais), reproduzir áudio TTS, navegar entre parágrafos e manter o progresso do usuário no banco.

## 2. Pré-requisitos

- Usuário selecionou um artigo (Spec 02) ou restaurou progresso (Spec 07).
- Nakdimon disponível como subprocesso Python.
- Modelo de voz Hebraico disponível para `piper-rs` (opcional para leitura sem áudio).

## 3. Fluxo Principal

1. **Carregamento inicial**: a aplicação verifica se o nikud do primeiro parágrafo está em cache.
   - Se em cache → exibe instantaneamente.
   - Se não → envia o texto ao Nakdimon via subprocesso; exibe "Preparando texto..." com indicador de progresso; salva resultado no cache SQLite.
2. **Exibição**: parágrafo com nikud em fonte hebraica legível e bem dimensionada, texto centralizado.
   - Acima: indicador "Parágrafo X de Y | Z% do artigo lido".
   - Abaixo: player de áudio com Play/Pause.
3. **Áudio**: ao clicar Play, verifica cache de áudio (`audio_cache`); se ausente, gera com `piper-rs`; reproduz; permite pausar/avançar/retroceder.
4. **Navegação**: setas ← (anterior) e → (próximo) no canto inferior direito. Ao navegar, progresso é atualizado no banco.
5. **Indicadores visuais**: parágrafos já lidos com fundo levemente cinza; parágrafo atual destacado.
6. A navegação repete o fluxo de nikud + áudio (usando cache quando possível) e aplica rolagem suave.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-03-01 | Processar nikud via subprocesso do Nakdimon, passando texto por argumento ou stdin e capturando a saída. |
| FR-03-02 | Processar um parágrafo por vez (sob demanda), não o artigo inteiro. |
| FR-03-03 | Verificar cache em `nikud_cache` (por `original_text`) antes de chamar o Nakdimon. |
| FR-03-04 | Salvar o resultado em cache após processamento. |
| FR-03-05 | Gerar áudio TTS via `piper-rs` para o texto com nikud do parágrafo atual. |
| FR-03-06 | Verificar `audio_cache` (por `text_hash`) antes de gerar áudio; salvar áudio em BLOB após geração. |
| FR-03-07 | Reproduzir áudio do sistema com controles de play/pause/seek. |
| FR-03-08 | Calcular percentual de leitura: `(parágrafo_atual / total_parágrafos) * 100`. |
| FR-03-09 | Persistir progresso em `user_progress` (parágrafo atual, total, `last_read`) a cada navegação. |
| FR-03-10 | Exibir indicador visual de parágrafos lidos vs. não lidos. |
| FR-03-11 | Aplicar animação de rolagem suave ao trocar de parágrafo. |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-03-01 | Texto hebraico centralizado, com fonte legível e tamanho configurável (Spec 08). |
| UI-03-02 | Indicador "Parágrafo X de Y | Z% do artigo lido" acima do texto. |
| UI-03-03 | Player de áudio (Play/Pause, barra de progresso) abaixo do texto. |
| UI-03-04 | Setas ←/→ no canto inferior direito. |
| UI-03-05 | Parágrafo atual destacado; lidos com fundo levemente cinza. |
| UI-03-06 | Mensagem "Preparando texto..." + spinner durante processamento de nikud. |
| UI-03-07 | Aviso silencioso (ícone de áudio desabilitado) quando TTS indisponível. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-03-01 | `nikud_cache(original_text UNIQUE, nikud_text)` consulta/insere por texto original. |
| DR-03-02 | `audio_cache(text_hash UNIQUE, audio_data BLOB)` consulta/insere por hash do texto. |
| DR-03-03 | `user_progress(article_id, current_paragraph_index, total_paragraphs, completed, last_read)` atualizado a cada navegação. |
| DR-03-04 | Índices `idx_progress_article`, `idx_nikud_original`, `idx_audio_hash` devem existir. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-03-01 | Nakdimon não encontrado ou falha no subprocesso | Exibir aviso "Serviço de nikud indisponível" e exibir texto sem nikud. |
| ER-03-02 | Modelo de voz TTS não carregado / erro de geração | Desabilitar botão de áudio e informar que áudio não está disponível no momento. |
| ER-03-03 | Falha ao persistir progresso | Tentar novamente; exibir aviso não bloqueante. |

## 8. Critérios de Aceite

- [ ] Primeiro parágrafo exibido com nikud em ≤ 3s (tempo médio) na primeira leitura; instantâneo quando em cache.
- [ ] Play gera e reproduz áudio hebraico; cache evita regeneração.
- [ ] Navegação entre parágrafos atualiza o indicador e o progresso no banco.
- [ ] Parágrafos lidos vs. atual são visualmente distintos.

## 9. Dependências

- Nakdimon (subprocesso Python via `std::process`), `piper-rs` (+ modelo `he`), SQLite (`rusqlite`).
