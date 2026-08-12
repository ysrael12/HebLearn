# Specs de Funcionalidades — "Aprendiz de Hebraico com Wikipédia"

Este diretório contém as especificações técnicas detalhadas de cada funcionalidade da aplicação, derivadas do documento [`../proposta_produto.md`](../proposta_produto.md).

Cada spec segue o mesmo template e cobre: objetivo, pré-requisitos, fluxo, requisitos funcionais, dados, UI/UX, erros e critérios de aceite.

## Índice

| # | Spec | Funcionalidade | Tela |
| :--- | :--- | :--- | :--- |
| 1 | [01-inicializacao.md](01-inicializacao.md) | Inicialização da aplicação | Tela de Boas-Vindas |
| 2 | [02-busca-artigo.md](02-busca-artigo.md) | Buscar artigo da Wikipédia | Tela de Busca |
| 3 | [03-leitura-nikud.md](03-leitura-nikud.md) | Ler parágrafo com nikud | Tela de Leitura |
| 4 | [04-traducao-hover.md](04-traducao-hover.md) | Tradução de palavra (hover) | Tela de Leitura |
| 5 | [05-flashcards.md](05-flashcards.md) | Flashcards para memorização | Tela de Flashcards |
| 6 | [06-avancar-paragrafo.md](06-avancar-paragrafo.md) | Avançar para o próximo parágrafo | Tela de Flashcards |
| 7 | [07-continuar-leitura.md](07-continuar-leitura.md) | Continuar leitura salva | Tela de Boas-Vindas |
| 8 | [08-configuracao.md](08-configuracao.md) | Configurações da aplicação | Modal de Configurações |
| 9 | [09-estatisticas.md](09-estatisticas.md) | Estatísticas de aprendizado | Tela de Estatísticas |
| 10 | [10-cache-armazenamento.md](10-cache-armazenamento.md) | Gerenciar cache e armazenamento | Configurações |
| 11 | [11-internacionalizacao.md](11-internacionalizacao.md) | Internacionalização (i18n) e idioma da interface | Tela de Configuração Inicial |

## Convenções

- **IDs de requisito**: `FR-<NN>-<XX>` (Funcional), `DR-<NN>-<XX>` (Dados), `UI-<NN>-<XX>` (Interface), `ER-<NN>-<XX>` (Erros), onde `<NN>` é o número da spec.
- **Critérios de aceite** são verificáveis e mensuráveis.
- **Serviços externos** (Wikipédia, Nakdimon, LibreTranslate, OpenSERP, piper-rs) são referenciados conforme a arquitetura da proposta.
