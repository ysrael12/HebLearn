# Spec 02 — Buscar Artigo da Wikipédia

## 1. Objetivo

Permitir que o usuário busque um artigo pelo título em **português**, selecione um resultado e tenha a versão em **hebraico** do artigo baixada, salva no banco e aberta na Tela de Leitura.

## 2. Pré-requisitos

- Usuário clicou em "Iniciar Nova Leitura" na Tela de Boas-Vindas.
- Conexão com a internet (para consultas à Wikipédia).

## 3. Fluxo Principal

1. Usuário é levado à **Tela de Busca de Artigos**.
2. Interface exibe campo de busca com placeholder "Digite o nome do artigo em português...", botão "Buscar", área de resultados (vazia) e nota informativa.
3. Enquanto digita, a aplicação faz requisições de **autocomplete** à API da Wikipédia em português.
4. Usuário pressiona "Enter" ou clica em "Buscar".
5. A aplicação consulta `pt.wikipedia.org` e exibe lista de artigos com título em português e trecho do primeiro parágrafo.
6. Ícone de carregamento é exibido durante a busca.
7. Usuário clica no título do artigo desejado.
8. Em background: a aplicação busca a versão em hebraico via `he.wikipedia.org` (interwiki ou título traduzido), baixa o texto completo e salva no SQLite.
9. Usuário é levado à **Tela de Leitura**, com o primeiro parágrafo já processado com nikud.

## 4. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-02-01 | Busca por termo em português via API de busca da Wikipédia em português. |
| FR-02-02 | Autocomplete de títulos enquanto o usuário digita (com debounce, ex: 300ms). |
| FR-02-03 | Exibir lista de resultados: título em português + resumo (trecho do primeiro parágrafo). |
| FR-02-04 | Exibir indicador de carregamento durante requisições. |
| FR-02-05 | Ao selecionar artigo, resolver a correspondência em hebraico (interwiki `langlink` ou busca pelo título traduzido). |
| FR-02-06 | Baixar o texto completo do artigo em hebraico e dividi-lo em parágrafos. |
| FR-02-07 | Salvar o artigo no banco (tabela `articles`) antes de abrir a Tela de Leitura. |
| FR-02-08 | Evitar duplicação de artigos: se o mesmo `url`/`title_he` já existir, reutilizar o `article_id` existente. |
| FR-02-09 | Após salvar, navegar para a Tela de Leitura iniciando o processamento do primeiro parágrafo (Spec 03). |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-02-01 | Campo de busca único com placeholder em português. |
| UI-02-02 | Botão "Buscar" ao lado do campo. |
| UI-02-03 | Área de resultados com lista clicável (título + resumo). |
| UI-02-04 | Nota informativa: "Digite o título do artigo em português para buscar a versão em hebraico." |
| UI-02-05 | Spinner de carregamento durante a busca. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-02-01 | Inserir em `articles`: `title_he`, `title_pt`, `url`, `fetched_at`. |
| DR-02-02 | `title_he` e `title_pt` são obrigatórios e não nulos. |
| DR-02-03 | O texto do artigo deve ser persistido de forma a permitir acesso por parágrafo (ex.: tabela de parágrafos vinculados ao `article_id`, ou armazenamento do HTML/plain text completo). |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-02-01 | Nenhum resultado em português | "Nenhum artigo encontrado em português com este termo. Tente uma nova busca." |
| ER-02-02 | Erro de conexão com a Wikipédia | "Não foi possível conectar à Wikipédia. Verifique sua conexão com a internet." |
| ER-02-03 | Versão em hebraico não encontrada | Sugerir artigos similares em hebraico ou permitir busca direta em hebraico. |
| ER-02-04 | Falha ao salvar no banco | Exibir erro e manter o usuário na Tela de Busca. |

## 8. Critérios de Aceite

- [ ] Buscar "Jerusalém" retorna o artigo e abre sua versão em hebraico na Tela de Leitura.
- [ ] O autocomplete sugere títulos conforme a digitação.
- [ ] O artigo salvo no banco não gera duplicata em buscas repetidas.
- [ ] Mensagens de erro são exibidas conforme a tabela de erros.

## 9. Dependências

- API REST da Wikipédia (`pt.wikipedia.org`, `he.wikipedia.org`), SQLite, backend Rust (`reqwest`/HTTP client).
