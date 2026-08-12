# Spec 10 — Gerenciar Cache e Armazenamento

## 1. Objetivo

Permitir ao usuário visualizar o estado do cache, limpá-lo manualmente e definir limites de tamanho para limpeza automática, otimizando espaço em disco e desempenho.

## 2. Pré-requisitos

- Usuário acessa as Configurações (Spec 08) e vai à seção "Cache".

## 3. Fluxo Principal

1. Usuário acessa Configurações → seção "Cache".
2. A aplicação exibe:
   - Número de textos em cache (nikud).
   - Número de áudios em cache.
   - Tamanho total do cache em MB.
3. Usuário clica em "Limpar Cache".
4. A aplicação remove todos os dados de cache do SQLite e exibe "Cache limpo com sucesso!".
5. Usuário pode definir um limite de tamanho (ex.: 500MB) para limpeza automática.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-10-01 | Exibir contagem de entradas em `nikud_cache`. |
| FR-10-02 | Exibir contagem de entradas em `audio_cache`. |
| FR-10-03 | Exibir contagem de entradas no cache de traduções/imagens (se aplicável). |
| FR-10-04 | Calcular e exibir o tamanho total do cache em MB (somando BLOBs e texto). |
| FR-10-05 | Limpar o cache (nikud, áudio, traduções, imagens) via transação SQL. |
| FR-10-06 | Exibir confirmação "Cache limpo com sucesso!". |
| FR-10-07 | Definir limite de tamanho de cache (em MB) persistido nas preferências. |
| FR-10-08 | Executar limpeza automática quando o cache exceder o limite configurado (ex.: limpar entradas mais antigas via `created_at`). |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-10-01 | Seção "Cache" nas Configurações com estatísticas (contagens + tamanho). |
| UI-10-02 | Botão "Limpar Cache" com confirmação antes de executar (dialog). |
| UI-10-03 | Campo para definir limite de tamanho (MB). |
| UI-10-04 | Feedback de sucesso após limpeza. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-10-01 | Cache armazenado em tabelas próprias (`nikud_cache`, `audio_cache`, e cache de traduções/imagens) com `created_at`. |
| DR-10-02 | Preferência `cache_size_limit_mb` persistida em `app_config`. |
| DR-10-03 | Limpeza automática remove entradas mais antigas primeiro (respeitando limites e dados de progresso — nunca remover `learned_words`/`user_progress`). |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-10-01 | Falha na operação de limpeza | Exibir mensagem de erro e manter dados intactos (transação com rollback). |
| ER-10-02 | Limite inválido (ex.: negativo ou não numérico) | Rejeitar entrada e exibir validação. |

## 8. Critérios de Aceite

- [ ] Contagens e tamanho do cache refletem o estado real do banco.
- [ ] "Limpar Cache" remove todos os dados de cache e exibe confirmação.
- [ ] Dados de progresso e palavras aprendidas **não** são removidos pela limpeza.
- [ ] O limite configurado dispara limpeza automática quando excedido.

## 9. Dependências

- SQLite (transações), Spec 08 (Configurações).
