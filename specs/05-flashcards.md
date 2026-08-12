# Spec 05 — Flashcards para Memorização

## 1. Objetivo

Gerar flashcards a partir das palavras-chave do parágrafo lido, exibindo a palavra em hebraico com nikud, imagem ilustrativa e tradução (revelada ao virar o cartão), permitindo marcar palavras como aprendidas ou repetir.

## 2. Pré-requisitos

- Usuário leu um parágrafo e está na Tela de Flashcards (acessada via botão "Praticar Vocabulário").
- LibreTranslate e OpenSERP disponíveis (ou caches preenchidos).

## 3. Fluxo de Acesso

- Após a leitura de um parágrafo, a aplicação exibe o botão "Praticar Vocabulário" abaixo do texto.
- Ao clicar, o usuário vai para a Tela de Flashcards.

## 4. Fluxo Principal

1. **Carregamento**: a aplicação extrai as **palavras-chave** do parágrafo, excluindo conectores e palavras comuns (stopwords).
2. Para cada palavra:
   - Verifica se já está em `learned_words`.
   - Traduz para o português via LibreTranslate (usando cache).
   - Busca imagem relevante via OpenSERP (usando cache).
   - Exibe cartão com a palavra hebraica (com nikud) no topo.
3. **Exibição do cartão**: palavra em hebraico em destaque; imagem abaixo; indicador de palavra nova/já aprendida.
4. **Interação**: clique no cartão vira-o (efeito 3D de flip), revelando a tradução em português; a imagem permanece visível.
5. **Navegação**: setas ←/→ entre cartões; indicador "Palavra X de Y".
6. **Marcação**:
   - "Aprendi" → marca como conhecida, move para deck de revisão.
   - "Repetir" → adiciona a um deck para revisão futura.
   - Métricas de progresso atualizadas em tempo real.

## 5. Requisitos Funcionais

| ID | Requisito |
| :--- | :--- |
| FR-05-01 | Extrair palavras-chave do parágrafo removendo stopwords e conectores. |
| FR-05-02 | Respeitar o limite "Número de Flashcards por Parágrafo" das Configurações (Spec 08), quando definido. |
| FR-05-03 | Verificar se cada palavra já consta em `learned_words` (indicador novo/aprendida). |
| FR-05-04 | Traduzir palavras via LibreTranslate com cache. |
| FR-05-05 | Buscar imagem por palavra via OpenSERP (endpoint `/bing/image` ou `/mega/image`) com cache por palavra. |
| FR-05-06 | Exibir cartões um a um, com navegação ←/→ e indicador "Palavra X de Y". |
| FR-05-07 | Flip do cartão (3D) revelando tradução em português. |
| FR-05-08 | Botão "Aprendi" → atualizar `learned_words.review_count` / estado e mover para deck de revisão. |
| FR-05-09 | Botão "Repetir" → marcar para revisão futura. |
| FR-05-10 | Atualizar métricas de progresso em tempo real. |

## 6. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-05-01 | Cartão com palavra hebraica em destaque no topo. |
| UI-05-02 | Imagem ilustrativa visível na frente e verso do cartão. |
| UI-05-03 | Indicador visual de palavra nova vs. já aprendida. |
| UI-05-04 | Efeito 3D de flip ao clicar no cartão. |
| UI-05-05 | Setas ←/→ e indicador "Palavra X de Y". |
| UI-05-06 | Botões "Aprendi" e "Repetir" visíveis após o flip. |

## 7. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-05-01 | `learned_words` armazena estado de aprendizado e `review_count`. |
| DR-05-02 | Cache de imagens: tabela ou coluna dedicada (termo de busca → lista de URLs). |
| DR-05-03 | Persistir associação entre flashcards revisados e o parágrafo/artigo para rastreamento. |

## 8. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-05-01 | OpenSERP indisponível | Exibir cartão sem imagem, com placeholder, e aviso não bloqueante. |
| ER-05-02 | Tradução indisponível | Exibir cartão com "Tradução não disponível" ao virar. |
| ER-05-03 | Nenhuma palavra-chave extraída | Exibir mensagem "Nenhuma palavra nova neste parágrafo" e opção de avançar. |

## 9. Critérios de Aceite

- [ ] Flashcards são gerados somente com palavras-chave (sem conectores).
- [ ] O flip revela a tradução corretamente; imagem permanece visível.
- [ ] "Aprendi" e "Repetir" persistem o estado e atualizam as métricas.
- [ ] Cartões em cache (tradução/imagem) não refazem chamadas de rede.

## 10. Dependências

- LibreTranslate, OpenSERP, SQLite, backend Rust.
