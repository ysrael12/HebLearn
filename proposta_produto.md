# Documento Técnico do Projeto "Aprendiz de Hebraico com Wikipédia" (Atualizado)

---

## 1. Visão Geral e Arquitetura

O projeto é uma aplicação desktop desenvolvida em **Rust com Tauri**, que oferece uma experiência de aprendizado de hebraico através da leitura de artigos da Wikipédia. O foco principal é a **performance e eficiência**, garantindo que a aplicação rode suavemente em máquinas com recursos limitados (4GB de RAM).

### 1.1. Stack Tecnológico Definitivo

| Componente | Tecnologia/Ferramenta | Justificativa |
| :--- | :--- | :--- |
| **Frontend** | React com Tauri (Tauri v2) | Interface desktop nativa com webview, executável ~600KB . |
| **Backend** | Rust (Tauri backend) | Performance e baixo uso de memória, ideais para máquinas com 4GB de RAM. |
| **Adição de Nikud** | Nakdimon (via subprocesso) | Abordagem mais simples e madura para integração . |
| **TTS (Voz)** | `piper-rs` (Rust) | Biblioteca puramente Rust, integração nativa e suporte a Hebraico via eSpeak-ng . |
| **Tradução** | LibreTranslate (Self-Hosted) | API REST open-source, garante privacidade e funcionamento offline . |
| **Busca de Imagens** | OpenSERP (Self-Hosted) | Agrega resultados de múltiplos motores (Bing, Google, etc.) via API . |
| **Banco de Dados** | SQLite (via `rusqlite`) | Leve, embutido, ideal para cache e progresso do usuário . |
| **Cache** | SQLite + Redis (opcional) | Cache de nikud, áudio e traduções para otimização . |

### 1.2. Diagrama de Arquitetura

O fluxo de dados e comunicação entre os componentes é o seguinte:

```mermaid
graph TD
    A[Interface Desktop Tauri] --> B[Backend Rust];
    B --> C[Subprocesso Nakdimon (Python)];
    B --> D[`piper-rs` (Rust)];
    B --> E[API REST LibreTranslate];
    B --> F[API REST OpenSERP];
    B --> G[SQLite Database];

    subgraph "Serviços Auto-Hospedados"
        E;
        F;
    end

    C --> H[Texto com Nikud];
    D --> I[Áudio .wav];
    E --> J[Tradução];
    F --> K[URLs de Imagens];
    G --> L[Progresso do Usuário + Cache];
```

---

## 2. Decisões Técnicas Detalhadas

### 2.1. Por que Rust + Tauri?

A escolha do **Rust com Tauri** é a base do projeto para alcançar performance e baixo consumo de memória.

- **Performance**: Rust é uma linguagem compilada que oferece controle fino sobre a memória, sem um *garbage collector*, resultando em alta performance .
- **Tamanho do Executável**: Aplicações Tauri são extremamente leves, com binários de ~600KB, comparado aos ~120MB de uma aplicação Electron, o que é crucial para máquinas com pouca memória .
- **Frontend Moderno**: Tauri permite usar qualquer tecnologia web (React) para construir a interface, oferecendo uma experiência rica e familiar para os desenvolvedores .

### 2.2. Integração do Nakdimon (Rust ↔ Python)

A comunicação com o **Nakdimon** será feita via subprocesso, a abordagem mais simples e eficaz para este caso.

- **Mecanismo**: O backend Rust usará o módulo `std::process` para invocar o interpretador Python, executar o script do Nakdimon com o texto de entrada e capturar a saída .
- **Fluxo**:
    1. O Rust cria um subprocesso `python3`.
    2. Passa o texto hebraico como argumento ou via *stdin*.
    3. O Nakdimon processa o texto e retorna a versão com *nikud*.
    4. O Rust captura a saída e a envia para o frontend.
- **Otimização**: O texto será processado parágrafo por parágrafo para melhorar a latência percebida e usar *caching* para evitar reprocessamento desnecessário.

### 2.3. Síntese de Voz (TTS) com `piper-rs`

A biblioteca **`piper-rs`** foi escolhida por sua integração nativa com Rust e suporte ao Hebraico.

- **Hebraico**: A biblioteca usa o motor `eSpeak-ng` para converter texto em fonemas, que suporta oficialmente o Hebraico (código `he`) .
- **Integração**: Por ser uma crate Rust, a integração é direta. A aplicação pode baixar um modelo de voz pré-treinado para Hebraico e usar a API da biblioteca para gerar áudio, que pode ser reproduzido ou salvo .
- **Performance**: A biblioteca usa ONNX Runtime para inferência, o que é eficiente e pode rodar bem em CPU, um requisito para máquinas com 4GB de RAM .

### 2.4. Tradução com LibreTranslate

O **LibreTranslate** é uma excelente escolha por ser auto-hospedado, gratuito e respeitar a privacidade do usuário.

- **Implementação**: O backend Rust fará requisições HTTP `POST` para a API do LibreTranslate, que estará rodando em um contêiner Docker local .
- **Exemplo de Requisição**:
    ```json
    {
        "q": "שלום עולם",
        "source": "he",
        "target": "pt",
        "api_key": "sua_chave_api"
    }
    ```
- **Privacidade**: Todas as traduções acontecem localmente, nenhum dado é enviado para serviços de terceiros .

### 2.5. Busca de Imagens com OpenSERP

O **OpenSERP** fornece uma API robusta para buscar imagens de múltiplas fontes, como Bing e Google .

- **Implementação**: Assim como o LibreTranslate, o OpenSERP será executado localmente (via Docker). O backend Rust fará requisições para seus endpoints, como `/bing/image` ou `/mega/image` para buscas consolidadas .
- **Exemplo de Endpoint**: `GET /bing/image?text=livro&limit=5` retornaria uma lista de URLs de imagens sobre livros .

### 2.6. Sistema de Progresso e Estado

O sistema de progresso é fundamental para a experiência do usuário, permitindo que ele retome a leitura exatamente de onde parou.

#### 2.6.1. Estrutura do Banco de Dados (SQLite)

```sql
-- Tabela de artigos
CREATE TABLE articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_he TEXT NOT NULL,          -- Título em hebraico
    title_pt TEXT NOT NULL,          -- Título em português (para busca)
    url TEXT NOT NULL,               -- URL do artigo
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de progresso do usuário
CREATE TABLE user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    current_paragraph_index INTEGER DEFAULT 0,
    total_paragraphs INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    last_read TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- Tabela de cache de nikud (para evitar reprocessamento)
CREATE TABLE nikud_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL UNIQUE,  -- Texto sem nikud
    nikud_text TEXT NOT NULL,            -- Texto com nikud
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de cache de áudio
CREATE TABLE audio_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_hash TEXT NOT NULL UNIQUE,      -- Hash do texto para busca rápida
    audio_data BLOB NOT NULL,            -- Dados do áudio (WAV/MP3)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de palavras aprendidas
CREATE TABLE learned_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_he TEXT NOT NULL,
    word_pt TEXT NOT NULL,
    learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_count INTEGER DEFAULT 0
);

-- Índices para performance
CREATE INDEX idx_progress_article ON user_progress(article_id);
CREATE INDEX idx_nikud_original ON nikud_cache(original_text);
CREATE INDEX idx_audio_hash ON audio_cache(text_hash);
```

#### 2.6.2. Métricas de Progresso

Para acompanhar o progresso do usuário de forma granular, a aplicação calculará as seguintes métricas:

| Métrica | Descrição | Cálculo |
| :--- | :--- | :--- |
| **Progresso de Leitura** | Percentual de parágrafos lidos | `(parágrafos_lidos / total_parágrafos) * 100` |
| **Palavras Aprendidas** | Total de palavras marcadas como "aprendidas" | Contagem na tabela `learned_words` |
| **Tempo de Estudo** | Tempo total gasto na aplicação | Soma dos tempos de sessão |
| **Sessão Atual** | Duração da sessão atual | Desde o início da sessão |
| **Velocidade de Leitura** | Palavras por minuto | `(palavras_lidas / tempo_total) * 60` |
| **Retenção de Vocabulário** | Percentual de palavras lembradas em revisões futuras | `(acertos / total_revisões) * 100` |
| **Consistência** | Dias consecutivos de uso | Contagem de dias com atividade |

#### 2.6.3. Estrutura do Estado da Aplicação

O estado da aplicação será gerenciado pelo backend Rust e sincronizado com o frontend React via eventos Tauri.

```rust
// Estrutura do estado em Rust
struct AppState {
    // Artigo atual
    current_article: Option<Article>,
    // Progresso do usuário
    progress: UserProgress,
    // Cache de nikud
    nikud_cache: HashMap<String, String>,
    // Cache de áudio
    audio_cache: HashMap<String, Vec<u8>>,
    // Palavras aprendidas
    learned_words: Vec<LearnedWord>,
    // Sessão atual
    session: Session,
}

struct UserProgress {
    article_id: i64,
    current_paragraph: usize,
    total_paragraphs: usize,
    completed: bool,
    words_learned: usize,
    time_spent: Duration,
    last_activity: DateTime<Utc>,
}

struct Session {
    start_time: DateTime<Utc>,
    paragraphs_read: usize,
    words_clicked: usize,
    translations_requested: usize,
    audio_plays: usize,
}
```

---

## 3. Roteiro de Experiência do Usuário (UX)

### Caso de Uso 1: Inicialização da Aplicação

**Ator:** Usuário (Iniciante ou Avançado em Hebraico)

**Pré-condição:** A aplicação está instalada no computador do usuário (Windows).

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário clica duas vezes no ícone do aplicativo "Aprendiz de Hebraico".
2.  **Resposta do Sistema:** A aplicação inicia rapidamente (em segundos) mostrando uma **Tela de Boas-Vindas**. A tela é limpa e minimalista, com o logotipo do projeto e três botões principais:
    - **"Iniciar Nova Leitura"**
    - **"Continuar Leitura"** (habilitado se houver progresso salvo)
    - **"Estatísticas de Aprendizado"**
3.  **Feedback Visual:** Um pequeno indicador de carregamento (spinner) pode aparecer brevemente enquanto os serviços internos são inicializados, mas a aplicação deve estar responsiva em menos de 2 segundos.

---

### Caso de Uso 2: Buscar um Artigo da Wikipédia

**Ator:** Usuário

**Pré-condição:** O usuário está na Tela de Boas-Vindas e clicou em "Iniciar Nova Leitura".

**Fluxo Principal:**

1.  **Ação do Usuário:** Ao clicar em "Iniciar Nova Leitura", o usuário é levado para a **Tela de Busca de Artigos**.
2.  **Interface:** A tela apresenta:
    - Um campo de busca (input) com o placeholder "Digite o nome do artigo em **português**..."
    - Um botão "Buscar"
    - Uma área de resultados (inicialmente vazia).
    - Uma nota informativa: "Digite o título do artigo em português para buscar a versão em hebraico."
3.  **Ação do Usuário:** O usuário digita um termo de busca em **Português** (ex: "Jerusalém").
4.  **Resposta do Sistema:** Enquanto o usuário digita, a aplicação pode já estar fazendo requisições à API da Wikipédia para sugerir títulos de artigos em português (autocomplete), melhorando a experiência.
5.  **Ação do Usuário:** O usuário pressiona "Enter" ou clica no botão "Buscar".
6.  **Resposta do Sistema:**
    - A aplicação envia a consulta para a API da Wikipédia em português (`pt.wikipedia.org`).
    - Uma lista de artigos relevantes aparece na área de resultados, mostrando o título do artigo em **português** e um pequeno resumo (trecho do primeiro parágrafo em português).
    - Um ícone de "carregando" é exibido enquanto a busca é realizada.
7.  **Ação do Usuário:** O usuário clica no título do artigo desejado (ex: "Jerusalém") para selecioná-lo.
8.  **Resposta do Sistema (Background):**
    - A aplicação automaticamente **busca a versão em hebraico** do mesmo artigo usando a API da Wikipédia em hebraico (`he.wikipedia.org`), utilizando o interwiki ou o título traduzido.
    - O texto completo do artigo em hebraico é baixado.
    - O conteúdo é salvo no banco de dados SQLite com os metadados do artigo.
9.  **Resposta do Sistema (Interface):** O usuário é levado diretamente para a **Tela de Leitura**, com o primeiro parágrafo do artigo em hebraico já processado com *nikud*.

**Fluxos Alternativos:**

- **Nenhum resultado em português:** A aplicação exibe a mensagem "Nenhum artigo encontrado em português com este termo. Tente uma nova busca."
- **Erro de Conexão:** A aplicação exibe a mensagem "Não foi possível conectar à Wikipédia. Verifique sua conexão com a internet."
- **Versão em hebraico não encontrada:** Se não houver correspondência exata, a aplicação sugere artigos similares em hebraico ou permite que o usuário busque diretamente em hebraico.

---

### Caso de Uso 3: Ler um Parágrafo com Nikud

**Ator:** Usuário

**Pré-condição:** O usuário selecionou um artigo e está na **Tela de Leitura**.

**Fluxo Principal:**

1.  **Carregamento Inicial:**
    - A aplicação verifica se o nikud do primeiro parágrafo já está em cache.
    - Se estiver em cache, exibe instantaneamente.
    - Se não, envia o texto para o **Nakdimon** (via subprocesso) para adição de *nikud*.
    - Durante o processamento, a tela mostra uma mensagem "Preparando texto..." com um indicador de progresso.
    - O processo leva, em média, de 1 a 3 segundos para parágrafos curtos.
    - Após processado, salva no cache SQLite para uso futuro.
2.  **Exibição do Texto:**
    - O parágrafo é exibido na tela com **todos os *nikud* (vogais)** e uma **fonte hebraica legível e bem dimensionada**.
    - O texto é centralizado para fácil leitura.
    - Acima do texto, há um indicador de progresso: "Parágrafo X de Y | Z% do artigo lido".
    - Abaixo do texto, há um **player de áudio** com botões "Play/Pause".
3.  **Reprodução de Áudio:**
    - A ação do usuário pode ser:
        - Clicar em "Play" para ouvir a pronúncia do parágrafo.
        - A aplicação verifica se o áudio está em cache. Se não, gera o áudio em segundo plano usando o `piper-rs`.
        - O áudio é reproduzido diretamente pelo sistema.
    - O usuário pode pausar, avançar ou retroceder no áudio.
4.  **Navegação entre Parágrafos:**
    - No canto inferior direito da tela, há duas setas:
        - **← (Anterior)**: Leva ao parágrafo anterior do artigo.
        - **→ (Próximo)**: Leva ao próximo parágrafo.
        - Ao navegar, o progresso do usuário é automaticamente atualizado no banco de dados.
5.  **Indicadores Visuais:**
    - Parágrafos já lidos são marcados com uma cor diferente (ex: fundo levemente cinza).
    - O parágrafo atual é destacado.
6.  **Ação do Usuário:** O usuário clica na seta "Próximo".
7.  **Resposta do Sistema:**
    - A aplicação carrega o próximo parágrafo.
    - O processo de adição de *nikud* e geração de áudio se repete (usando cache sempre que possível).
    - O texto é exibido com rolagem suave (scroll animation) para uma transição agradável.

**Fluxos Alternativos:**

- **Áudio não disponível:** Se o modelo de voz não estiver carregado ou houver erro, a aplicação exibe um aviso silencioso (ex: ícone de áudio desabilitado) e informa que o áudio não está disponível no momento.

---

### Caso de Uso 4: Ver Tradução de uma Palavra (Hover)

**Ator:** Usuário

**Pré-condição:** O usuário está na Tela de Leitura, visualizando um parágrafo com *nikud*.

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário move o cursor do mouse sobre uma palavra específica do texto em hebraico (ex: "יְרוּשָׁלַיִם").
2.  **Resposta do Sistema (Imediata):**
    - Um **tooltip/pop-up elegante** aparece próximo à palavra.
    - O pop-up exibe a tradução da palavra para o **Português** (ex: "Jerusalém").
    - Se houver múltiplas traduções, a principal é exibida.
    - Um botão "Adicionar aos Flashcards" aparece no pop-up.
3.  **Funcionamento Técnico:** A aplicação verifica primeiro se a tradução está em cache. Se não, envia a palavra para o serviço **LibreTranslate** (REST API) e exibe a resposta, salvando em cache.
4.  **Ação do Usuário:** O usuário clica em "Adicionar aos Flashcards".
5.  **Resposta do Sistema:** A palavra é salva na tabela `learned_words` e estará disponível na seção de flashcards.

**Fluxos Alternativos:**

- **Tradução não encontrada:** Se a API de tradução não retornar um resultado, o pop-up exibe a mensagem "Tradução não disponível".
- **Falha na API:** Se o serviço LibreTranslate estiver inativo, a aplicação exibe a mensagem "Serviço de tradução indisponível no momento. Tente novamente mais tarde."

---

### Caso de Uso 5: Realizar Flashcards para Memorização

**Ator:** Usuário

**Pré-condição:** O usuário leu um parágrafo e está na **Tela de Flashcards**.

**Fluxo de Acesso:**
- Após o usuário ler um parágrafo, a aplicação exibe um botão "Praticar Vocabulário" abaixo do texto.
- Ao clicar nele, o usuário é levado à Tela de Flashcards.

**Fluxo Principal:**

1.  **Carregamento dos Flashcards:**
    - A aplicação extrai as **palavras-chave** do parágrafo (excluindo conectores e palavras comuns).
    - Para cada palavra, a aplicação:
        - Verifica se a palavra já está na lista de aprendidas.
        - Traduz a palavra para o português (via LibreTranslate, usando cache).
        - Busca uma imagem relevante (via OpenSERP, usando cache).
        - Exibe o cartão com a palavra em hebraico (com *nikud*) no topo.
2.  **Exibição do Flashcard:**
    - O flashcard apresenta a **palavra em hebraico** em destaque.
    - Abaixo, uma **imagem** que representa visualmente o significado da palavra.
    - Um indicador mostra se a palavra é nova ou já foi aprendida.
3.  **Interação do Usuário:**
    - O usuário deve **clicar no cartão** para virá-lo (efeito 3D de flip).
    - Ao virar, a **tradução em português** é revelada.
    - A imagem permanece visível, reforçando a associação.
4.  **Navegação entre Cartões:**
    - Há setas "←" e "→" para navegar entre os cartões do parágrafo.
    - Um indicador "Palavra X de Y" mostra o progresso.
5.  **Marcação de Aprendizado:**
    - O usuário pode clicar em "Aprendi" para marcar a palavra como conhecida.
    - O cartão é movido para um "deck de revisão" (para futuras revisões).
    - O usuário pode clicar em "Repetir" para adicionar a palavra a um deck para revisão futura.
    - As métricas de progresso são atualizadas em tempo real.

---

### Caso de Uso 6: Avançar para o Próximo Parágrafo Após Flashcards

**Ator:** Usuário

**Pré-condição:** O usuário terminou todos os flashcards do parágrafo atual.

**Fluxo Principal:**

1.  **Resposta do Sistema:**
    - Ao finalizar o último flashcard, a aplicação exibe uma mensagem de parabéns: "Parabéns! Você completou o vocabulário deste parágrafo."
    - Um resumo do progresso é exibido: "Você aprendeu X novas palavras neste parágrafo."
    - Um botão "Avançar para o Próximo Parágrafo" é exibido em destaque.
2.  **Ação do Usuário:** O usuário clica no botão.
3.  **Resposta do Sistema:**
    - A aplicação carrega o próximo parágrafo do artigo (se houver).
    - O progresso do usuário é atualizado no banco de dados (parágrafo atual +1).
    - O ciclo de leitura + flashcards se repete.

**Fluxo Alternativo (Fim do Artigo):**
- Se não houver mais parágrafos, a aplicação exibe uma tela de "Artigo Concluído", com estatísticas detalhadas de aprendizado:
    - Total de palavras aprendidas.
    - Tempo gasto.
    - Parágrafos lidos.
    - Botões para "Voltar à Busca", "Revisar Flashcards" ou "Sair".

---

### Caso de Uso 7: Continuar uma Leitura Salva

**Ator:** Usuário

**Pré-condição:** O usuário havia iniciado uma leitura anteriormente e clicou em "Sair" ou fechou a aplicação.

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário inicia a aplicação e, na Tela de Boas-Vindas, clica no botão **"Continuar Leitura"** (que agora está habilitado, pois há progresso salvo no banco de dados).
2.  **Resposta do Sistema:**
    - A aplicação consulta o banco de dados SQLite.
    - Restaura o estado salvo, que inclui:
        - Nome do artigo (em hebraico e português).
        - Número do último parágrafo lido.
        - Palavras marcadas como "aprendidas".
        - Flashcard concluídos.
    - O usuário é levado diretamente para a Tela de Leitura, no parágrafo exato onde parou.
3.  **Feedback Visual:** Uma mensagem "Progresso restaurado com sucesso!" é exibida brevemente.

---

### Caso de Uso 8: Configurar a Aplicação (Opções)

**Ator:** Usuário

**Pré-condição:** O usuário está em qualquer tela da aplicação.

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário clica em um ícone de "Configurações" (engrenagem) no canto superior direito.
2.  **Resposta do Sistema:** Abre uma tela ou modal com opções de configuração:
    - **Aparência:**
        - **Tamanho da Fonte:** Ajustar o tamanho da fonte do texto hebraico (pequeno, médio, grande).
        - **Tema:** Claro, Escuro ou Automático.
    - **Áudio:**
        - **Velocidade do Áudio:** Controlar a velocidade de reprodução do TTS (0.5x a 2x).
        - **Voz:** Selecionar entre diferentes vozes disponíveis (masculino/feminino).
    - **Tradução:**
        - **Idioma da Tradução:** Escolher o idioma alvo para traduções (ex: Português, Inglês, Espanhol).
        - **Mostrar Tradução Automática:** Ligar/desligar a tradução automática ao passar o mouse.
    - **Estudo:**
        - **Modo de Estudo:** Alternar entre "Leitura + Flashcards" (modo completo) ou apenas "Leitura".
        - **Número de Flashcards por Parágrafo:** Limitar a quantidade de palavras nos flashcards.
    - **Cache:**
        - **Limpar Cache:** Botão para limpar o cache de nikud, áudio e traduções.
        - **Tamanho do Cache:** Exibir o tamanho atual do cache.
    - **Sobre:**
        - Versão da aplicação.
        - Licenças das ferramentas utilizadas.

---

### Caso de Uso 9: Visualizar Estatísticas de Aprendizado

**Ator:** Usuário

**Pré-condição:** O usuário está na Tela de Boas-Vindas.

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário clica no botão **"Estatísticas de Aprendizado"**.
2.  **Resposta do Sistema:** A aplicação abre uma tela com um painel de estatísticas, mostrando:
    - **Gráfico de Progresso:** Linha do tempo com o progresso diário/semanal.
    - **Total de Artigos Lidos:** Contagem de artigos concluídos.
    - **Total de Palavras Aprendidas:** Número total de palavras marcadas como aprendidas.
    - **Tempo Total de Estudo:** Horas/minutos gastos na aplicação.
    - **Velocidade Média de Leitura:** Palavras por minuto.
    - **Consistência:** Dias consecutivos de uso (streak).
    - **Flashcards Revisados:** Contagem de revisões realizadas.
    - **Taxa de Acertos:** Percentual de acertos em revisões de flashcards.

**Nota:** Os dados são armazenados no banco de dados SQLite e podem ser exportados como CSV/JSON.

---

### Caso de Uso 10: Gerenciar Cache e Armazenamento

**Ator:** Usuário

**Pré-condição:** O usuário quer otimizar o espaço em disco ou o desempenho.

**Fluxo Principal:**

1.  **Ação do Usuário:** O usuário acessa as Configurações e vai até a seção "Cache".
2.  **Resposta do Sistema:** Exibe informações sobre o cache:
    - Número de textos em cache (nikud).
    - Número de áudios em cache.
    - Tamanho total do cache em MB.
3.  **Ação do Usuário:** O usuário clica no botão "Limpar Cache".
4.  **Resposta do Sistema:**
    - A aplicação remove todos os dados de cache do banco de dados SQLite.
    - Exibe uma mensagem "Cache limpo com sucesso!".
5.  **Ação do Usuário:** O usuário pode também definir um limite de tamanho do cache (ex: 500MB) para limpeza automática.

---

## 4. Resumo dos Casos de Uso e Telas

| # | Caso de Uso | Tela Correspondente | Fluxo Principal |
| :--- | :--- | :--- | :--- |
| **1** | Inicialização | Tela de Boas-Vindas | Iniciar/Continuar leitura ou ver estatísticas. |
| **2** | Buscar Artigo | Tela de Busca | Digitar termo em português → Selecionar artigo → Buscar versão em hebraico. |
| **3** | Ler com Nikud | Tela de Leitura | Visualizar texto com nikud + Ouvir áudio + Navegar parágrafos. |
| **4** | Tradução Hover | Tela de Leitura | Passar mouse sobre palavra → Ver tradução → Adicionar aos flashcards. |
| **5** | Flashcards | Tela de Flashcards | Ver palavra + imagem → Virar cartão → Ver tradução → Marcar como aprendida. |
| **6** | Avançar | Tela de Flashcards | Após flashcards → Próximo parágrafo. |
| **7** | Continuar | Tela de Boas-Vindas | Restaurar progresso salvo. |
| **8** | Configurar | Modal de Configurações | Ajustar preferências de aparência, áudio, tradução e estudo. |
| **9** | Estatísticas | Tela de Estatísticas | Visualizar métricas de aprendizado. |
| **10** | Gerenciar Cache | Configurações | Limpar cache ou definir limites. |

---

## 5. Otimização para 4GB de RAM

A estratégia para garantir a performance em máquinas com 4GB de RAM envolve:

1.  **Processamento Local**: Toda a inferência (Nakdimon e TTS) e os serviços (LibreTranslate, OpenSERP) são locais, sem dependência de rede.
2.  **Arquitetura Leve**: Tauri e Rust minimizam o consumo de memória base da aplicação .
3.  **Cache em Camadas**: O uso do SQLite para cache de nikud, áudio e traduções evita recálculos desnecessários.
4.  **Processamento Sob Demanda**: O Nakdimon processa apenas o parágrafo atual, não o artigo inteiro, reduzindo o pico de uso de memória e CPU.
5.  **Gerenciamento de Cache**: Limites de tamanho e limpeza automática para evitar acúmulo desnecessário.
6.  **Modelos Leves**: Uso de modelos quantizados para TTS (via `piper-rs`) que rodam em CPU sem consumo excessivo de RAM.

---

## 6. Cronograma de Implementação

A implementação será dividida em sprints de 2 semanas, conforme abaixo:

| Fase | Duração | Atividades |
| :--- | :--- | :--- |
| **1. Fundação** | 2 semanas | Configurar o projeto Tauri, definir a estrutura de comunicação com o backend Rust, implementar a busca e extração de texto da Wikipédia (português → hebraico), criar o banco de dados SQLite. |
| **2. Interface e Nikud** | 2 semanas | Desenvolver a tela de leitura com navegação por parágrafos, integrar o Nakdimon via subprocesso e implementar o sistema de cache. |
| **3. Tradução e TTS** | 2 semanas | Integrar o LibreTranslate (como serviço) e o `piper-rs` para síntese de voz. Implementar a funcionalidade de passar o mouse para traduzir. |
| **4. Flashcards** | 2 semanas | Desenvolver a seção de flashcards, integrar o OpenSERP para busca de imagens e conectar o aprendizado à leitura. |
| **5. Progresso e Finalização** | 1 semana | Implementar o sistema de progresso, estatísticas e configurações. Testes de performance em máquinas com 4GB, polimento da UI, criação do instalador e documentação. |
| **Total** | **9 semanas** | |

---

Este documento consolida todas as decisões do projeto e serve como o ponto de partida para a implementação. O foco agora é na arquitetura leve e eficiente que garantirá uma excelente experiência para o usuário.
