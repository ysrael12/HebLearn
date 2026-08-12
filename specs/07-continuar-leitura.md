# Spec 07 — Continuar Leitura Salva

## 1. Objetivo

Restaurar a sessão de leitura exatamente de onde o usuário parou quando ele retorna à aplicação e clica em "Continuar Leitura".

## 2. Pré-requisitos

- Existe progresso salvo no banco (artigo não concluído, `completed = FALSE`).
- Usuário está na Tela de Boas-Vindas (Spec 01).

## 3. Fluxo Principal

1. Usuário clica em "Continuar Leitura".
2. A aplicação consulta o SQLite e restaura o estado salvo:
   - Nome do artigo (hebraico e português).
   - Índice do último parágrafo lido.
   - Palavras marcadas como aprendidas.
   - Flashcards concluídos.
3. Usuário é levado diretamente à **Tela de Leitura**, no parágrafo exato onde parou.
4. Mensagem "Progresso restaurado com sucesso!" é exibida brevemente.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-07-01 | Consultar o artigo não concluído mais recente (`last_read` mais recente e `completed = FALSE`). |
| FR-07-02 | Restaurar `current_paragraph_index` e posicionar a Tela de Leitura nesse parágrafo. |
| FR-07-03 | Carregar as palavras aprendidas associadas à sessão para a Tela de Leitura e Flashcards. |
| FR-07-04 | Restaurar o estado dos flashcards concluídos para o parágrafo atual. |
| FR-07-05 | Exibir mensagem de confirmação "Progresso restaurado com sucesso!" (feedback breve). |
| FR-07-06 | Se não houver progresso salvo, o botão "Continuar Leitura" permanece desabilitado (Spec 01). |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-07-01 | Feedback não intrusivo (toast) de restauração de progresso. |
| UI-07-02 | Tela de Leitura abre diretamente no parágrafo salvo, com indicadores de progresso corretos. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-07-01 | Restaurar estado a partir de `articles`, `user_progress` e `learned_words`. |
| DR-07-02 | Manter rastreabilidade entre `learned_words` e artigo/parágrafo para restauração precisa. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-07-01 | Dados de progresso inconsistentes (parágrafo > total) | Corrigir índice para o último válido e notificar o usuário. |
| ER-07-02 | Falha na consulta ao banco | Exibir mensagem de erro e manter usuário na Tela de Boas-Vindas. |

## 8. Critérios de Aceite

- [ ] Ao clicar em "Continuar Leitura", o usuário retorna ao parágrafo exato onde parou.
- [ ] Palavras aprendidas e flashcards concluídos são restaurados.
- [ ] A mensagem de restauração é exibida brevemente.
- [ ] Sem progresso salvo, o botão fica desabilitado.

## 9. Dependências

- Spec 01 (inicialização), SQLite, backend Rust.
