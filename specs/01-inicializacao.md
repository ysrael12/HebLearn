# Spec 01 — Inicialização da Aplicação

## 1. Objetivo

Garantir que a aplicação inicialize de forma rápida (< 2s responsiva), apresentando a Tela de Boas-Vindas com as opções de iniciar nova leitura, continuar leitura salva e acessar estatísticas.

## 2. Pré-requisitos

- Aplicação instalada no computador do usuário (Windows).
- Serviços internos (banco SQLite) prontos para uso local.

## 3. Fluxo Principal

1. Usuário clica duas vezes no ícone do aplicativo.
2. A aplicação inicia e apresenta a **Tela de Boas-Vindas**.
3. A tela exibe o logotipo do projeto e três botões:
   - **Iniciar Nova Leitura** (sempre habilitado).
   - **Continuar Leitura** (habilitado apenas se houver progresso salvo no banco).
   - **Estatísticas de Aprendizado**.
4. Durante a inicialização dos serviços internos, um spinner de carregamento é exibido.
5. A interface deve estar responsiva em menos de 2 segundos.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-01-01 | Ao abrir a aplicação, o backend Rust inicializa a conexão com o banco SQLite. |
| FR-01-02 | O backend consulta `user_progress` e verifica se existe progresso salvo (qualquer artigo com `completed = FALSE` ou `current_paragraph_index > 0`). |
| FR-01-03 | O botão "Continuar Leitura" reflete o estado do progresso: habilitado se houver artigo não concluído, desabilitado caso contrário. |
| FR-01-04 | O clique em "Iniciar Nova Leitura" navega para a Tela de Busca de Artigos. |
| FR-01-05 | O clique em "Continuar Leitura" executa a Spec 07 (restauração de progresso). |
| FR-01-06 | O clique em "Estatísticas de Aprendizado" navega para a Tela de Estatísticas (Spec 09). |
| FR-01-07 | Se ocorrer erro na inicialização do banco, a aplicação exibe tela de erro e encerra graciosamente (sem travar). |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-01-01 | Tela limpa e minimalista, com logotipo centralizado. |
| UI-01-02 | Três botões de navegação em destaque, organizados verticalmente. |
| UI-01-03 | Spinner de carregamento visível apenas durante a inicialização dos serviços. |
| UI-01-04 | O estado desabilitado do botão "Continuar Leitura" deve ser visualmente claro (cinza). |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-01-01 | A consulta de progresso deve retornar o artigo salvo mais recente (`last_read` mais recente) não concluído. |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-01-01 | Falha ao abrir o banco SQLite | Tela de erro com descrição; encerrar aplicação. |
| ER-01-02 | Corrupção do arquivo do banco | Reconstruir banco vazio (backup do arquivo corrompido). |

## 8. Critérios de Aceite

- [ ] A aplicação abre e exibe a Tela de Boas-Vindas em menos de 2 segundos.
- [ ] "Continuar Leitura" está desabilitado na primeira execução (sem dados).
- [ ] "Continuar Leitura" está habilitado quando existe progresso salvo não concluído.
- [ ] Todos os três botões navegam para a tela correta.

## 9. Dependências

- Backend Rust (Tauri), SQLite (`rusqlite`), comunicação frontend/backend via Tauri events.
