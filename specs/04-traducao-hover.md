# Spec 04 — Tradução de Palavra (Hover)

## 1. Objetivo

Permitir que o usuário passe o mouse sobre uma palavra hebraica e veja sua tradução para o português em um tooltip, com opção de adicioná-la aos flashcards.

## 2. Pré-requisitos

- Usuário está na Tela de Leitura visualizando um parágrafo com nikud.
- Serviço LibreTranslate disponível (ou cache preenchido).

## 3. Fluxo Principal

1. Usuário posiciona o cursor sobre uma palavra hebraica.
2. Um **tooltip elegante** aparece próximo à palavra com a tradução principal para o português.
3. Tecnicamente: verifica-se primeiro o cache de tradução; se ausente, faz `POST` ao LibreTranslate (`source: he`, `target: pt`) e salva no cache.
4. O tooltip exibe botão "Adicionar aos Flashcards".
5. Usuário clica em "Adicionar aos Flashcards".
6. A palavra é salva em `learned_words` e fica disponível na seção de flashcards.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-04-01 | Detectar a palavra sob o cursor e extrair o texto hebraico correspondente. |
| FR-04-02 | Verificar cache de tradução antes de chamar o LibreTranslate. |
| FR-04-03 | Chamar o serviço LibreTranslate (`POST /translate`, `source=he`, `target=pt`) quando a tradução não estiver em cache. |
| FR-04-04 | Exibir a tradução principal no tooltip (se houver múltiplas, exibir a principal). |
| FR-04-05 | Salvar a tradução em cache após recebimento (evitar reprocessamento). |
| FR-04-06 | Permitir "Adicionar aos Flashcards" → inserir em `learned_words(word_he, word_pt)`. |
| FR-04-07 | Se a palavra já está em `learned_words`, não duplicar (verificar antes da inserção). |
| FR-04-08 | Obedecer à preferência "Mostrar Tradução Automática" das Configurações (Spec 08): se desligada, não exibir tooltip automaticamente. |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-04-01 | Tooltip/pop-up elegante posicionado próximo à palavra (sem sobrepor o texto de forma bloqueante). |
| UI-04-02 | Tooltip exibe palavra hebraica + tradução em português. |
| UI-04-03 | Botão "Adicionar aos Flashcards" dentro do tooltip. |
| UI-04-04 | Feedback visual após adicionar aos flashcards (ex.: toast "Adicionado aos flashcards"). |
| UI-04-05 | Tooltip fecha ao mover o cursor para fora da palavra. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-04-01 | Cache de traduções: incluir tabela/coluna dedicada ou estender `learned_words` com cache de traduções por palavra (texto original → tradução). |
| DR-04-02 | `learned_words` deve registrar `word_he`, `word_pt`, `learned_at`, `review_count`. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-04-01 | Tradução não retornada pela API | Tooltip exibe "Tradução não disponível". |
| ER-04-02 | LibreTranslate inativo | Tooltip exibe "Serviço de tradução indisponível no momento. Tente novamente mais tarde." |
| ER-04-03 | Falha ao salvar em `learned_words` | Exibir aviso e não marcar como adicionado. |

## 8. Critérios de Aceite

- [ ] Hover em "יְרוּשָׁלַיִם" mostra "Jerusalém" no tooltip.
- [ ] Palavras já traduzidas são servidas do cache (sem nova chamada de API).
- [ ] "Adicionar aos Flashcards" persiste a palavra sem duplicatas.
- [ ] Com "Mostrar Tradução Automática" desligada, o tooltip não aparece.

## 9. Dependências

- LibreTranslate (REST API local), SQLite (cache + `learned_words`), backend Rust.
