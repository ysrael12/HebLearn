# Spec 09 — Estatísticas de Aprendizado

## 1. Objetivo

Apresentar um painel com métricas de aprendizado do usuário, agregadas a partir do banco SQLite, com opção de exportação.

## 2. Pré-requisitos

- Usuário está na Tela de Boas-Vindas (Spec 01).
- Existem dados de uso (leituras, palavras, sessões) no banco.

## 3. Fluxo Principal

1. Usuário clica em "Estatísticas de Aprendizado".
2. A aplicação agrega os dados do SQLite e exibe o painel.
3. Métricas exibidas:
   - **Gráfico de Progresso**: linha do tempo com progresso diário/semanal.
   - **Total de Artigos Lidos**: contagem de artigos concluídos.
   - **Total de Palavras Aprendidas**: contagem de `learned_words`.
   - **Tempo Total de Estudo**: soma dos tempos de sessão.
   - **Velocidade Média de Leitura**: `(palavras_lidas / tempo_total) * 60`.
   - **Consistência**: dias consecutivos de uso (streak).
   - **Flashcards Revisados**: contagem de revisões realizadas.
   - **Taxa de Acertos**: `(acertos / total_revisões) * 100`.
4. Usuário pode exportar os dados como **CSV/JSON**.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-09-01 | Calcular progresso de leitura por artigo: `(parágrafos_lidos / total_parágrafos) * 100`. |
| FR-09-02 | Calcular tempo total de estudo a partir da soma das sessões registradas. |
| FR-09-03 | Calcular velocidade de leitura (palavras/minuto) a partir de palavras lidas e tempo. |
| FR-09-04 | Calcular retenção de vocabulário: `(acertos / total_revisões) * 100`. |
| FR-09-05 | Calcular consistência (streak de dias consecutivos com atividade). |
| FR-09-06 | Exibir gráfico de progresso (diário/semanal) com dados históricos. |
| FR-09-07 | Exportar estatísticas para CSV e JSON. |
| FR-09-08 | Registrar sessão de estudo (início/fim) para cálculo de tempo. |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-09-01 | Painel com métricas organizadas em cards. |
| UI-09-02 | Gráfico de progresso (linha do tempo). |
| UI-09-03 | Botão de exportação (CSV/JSON). |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-09-01 | Tabela de sessões (`study_sessions`): `start_time`, `end_time`, duração, artigos/parágrafos lidos. |
| DR-09-02 | Tabela de revisões (`review_history`): palavra, resultado (acerto/erro), data. |
| DR-09-03 | `learned_words.review_count` e `articles.completed` como fontes de contagem. |
| DR-09-04 | Atividade diária derivada de `last_read`/`study_sessions` para o streak. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-09-01 | Falha ao agregar estatísticas | Exibir mensagem de erro e tela vazia com opção de recarregar. |
| ER-09-02 | Falha na exportação | Exibir mensagem informando caminho/permissão. |

## 8. Critérios de Aceite

- [ ] Todas as métricas listadas são exibidas com valores coerentes com o banco.
- [ ] O gráfico de progresso reflete atividade diária/semanal.
- [ ] A exportação CSV/JSON gera arquivo válido e baixável.
- [ ] Com dados vazios, a tela exibe estado vazio amigável (ex.: "Sem dados ainda — comece uma leitura!").

## 9. Dependências

- SQLite, backend Rust, biblioteca de gráficos no frontend (ex.: recharts/chart.js).
