# Spec 06 — Avançar para o Próximo Parágrafo (Após Flashcards)

## 1. Objetivo

Ao concluir os flashcards de um parágrafo, permitir que o usuário avance para o próximo parágrafo ou conclua o artigo com estatísticas de aprendizado.

## 2. Pré-requisitos

- Usuário finalizou todos os flashcards do parágrafo atual (Spec 05).

## 3. Fluxo Principal

1. Ao finalizar o último flashcard, a aplicação exibe:
   - Mensagem de parabéns: "Parabéns! Você completou o vocabulário deste parágrafo."
   - Resumo: "Você aprendeu X novas palavras neste parágrafo."
   - Botão em destaque: "Avançar para o Próximo Parágrafo".
2. Usuário clica no botão.
3. Se houver próximo parágrafo:
   - A aplicação o carrega (com nikud/áudio, Spec 03).
   - O progresso é atualizado no banco (`current_paragraph_index + 1`).
   - O ciclo leitura + flashcards se repete.

## 4. Fluxo Alternativo (Fim do Artigo)

Se não houver mais parágrafos, exibir tela de **"Artigo Concluído"** com:
- Total de palavras aprendidas.
- Tempo gasto.
- Parágrafos lidos.
- Botões: "Voltar à Busca", "Revisar Flashcards", "Sair".

## 5. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-06-01 | Detectar que o último flashcard do parágrafo foi concluído e exibir a tela de conclusão do parágrafo. |
| FR-06-02 | Calcular e exibir o número de palavras novas aprendidas no parágrafo. |
| FR-06-03 | Ao clicar em "Avançar para o Próximo Parágrafo", verificar existência de próximo parágrafo. |
| FR-06-04 | Atualizar `user_progress.current_paragraph_index` (+1) e `last_read` antes de navegar. |
| FR-06-05 | Se não houver próximo parágrafo, marcar artigo como concluído (`completed = TRUE`) e exibir tela "Artigo Concluído". |
| FR-06-06 | Na tela de conclusão do artigo, exibir estatísticas (palavras aprendidas, tempo, parágrafos lidos). |
| FR-06-07 | Botões da tela de conclusão: "Voltar à Busca", "Revisar Flashcards", "Sair" com ações corretas. |

## 6. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-06-01 | Mensagem de parabéns clara e resumo de palavras aprendidas. |
| UI-06-02 | Botão "Avançar para o Próximo Parágrafo" em destaque. |
| UI-06-03 | Tela "Artigo Concluído" com estatísticas em cards e botões de ação. |

## 7. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-06-01 | `user_progress.completed` atualizado para `TRUE` no fim do artigo. |
| DR-06-02 | `user_progress.current_paragraph_index` e `total_paragraphs` mantidos consistentes. |

## 8. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-06-01 | Falha ao persistir progresso ao avançar | Impedir navegação e exibir aviso de erro de salvamento. |
| ER-06-02 | Falha ao carregar o próximo parágrafo | Exibir mensagem e manter usuário na tela atual. |

## 9. Critérios de Aceite

- [ ] Ao terminar o último flashcard, a mensagem de parabéns com contagem de palavras é exibida.
- [ ] "Avançar" carrega o próximo parágrafo e persiste o novo índice.
- [ ] No último parágrafo, a tela "Artigo Concluído" é exibida com estatísticas corretas.
- [ ] Os três botões da tela de conclusão navegam corretamente.

## 10. Dependências

- Spec 03 (leitura/nikud), Spec 05 (flashcards), SQLite.
