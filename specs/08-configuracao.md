# Spec 08 — Configurações da Aplicação

## 1. Objetivo

Permitir que o usuário personalize aparência, áudio, tradução, modo de estudo e gerencie o cache a partir de um modal de Configurações acessível em qualquer tela.

## 2. Pré-requisitos

- Usuário em qualquer tela da aplicação.

## 3. Fluxo Principal

1. Usuário clica no ícone de engrenagem ("Configurações") no canto superior direito.
2. Abre tela/modal com as seções abaixo.
3. Usuário ajusta preferências; as alterações são aplicadas e persistidas.
4. Usuário fecha o modal.

## 4. Requisitos Funcionais

### 4.1. Aparência
| ID | Requisito |
| :--- | :--- |
| FR-08-01 | Ajustar tamanho da fonte do texto hebraico: pequeno, médio, grande. |
| FR-08-02 | Selecionar tema: claro, escuro ou automático. |

### 4.2. Áudio
| ID | Requisito |
| :--- | :--- |
| FR-08-03 | Controlar velocidade de reprodução do TTS (0.5x a 2.0x, em passos de 0.25). |
| FR-08-04 | Selecionar voz (ex.: masculino/feminino) entre as disponíveis no modelo. |

### 4.3. Tradução
| ID | Requisito |
| :--- | :--- |
| FR-08-05 | Escolher o idioma alvo para traduções (padrão: Português; opções: Inglês, Espanhol, etc.). |
| FR-08-06 | Ligar/desligar "Mostrar Tradução Automática" (comportamento do hover, Spec 04). |

### 4.4. Estudo
| ID | Requisito |
| :--- | :--- |
| FR-08-07 | Alternar modo de estudo: "Leitura + Flashcards" (completo) ou apenas "Leitura". |
| FR-08-08 | Definir número máximo de flashcards por parágrafo (aplicado na Spec 05). |

### 4.5. Cache
| ID | Requisito |
| :--- | :--- |
| FR-08-09 | Exibir tamanho atual do cache (nikud, áudio, traduções). |
| FR-08-10 | Botão "Limpar Cache" → delega à Spec 10. |

### 4.6. Sobre
| ID | Requisito |
| :--- | :--- |
| FR-08-11 | Exibir versão da aplicação e licenças das ferramentas utilizadas. |

### 4.7. Geral
| ID | Requisito |
| :--- | :--- |
| FR-08-12 | Persistir todas as preferências (em `app_config`/tabela de preferências do SQLite ou arquivo de configuração). |
| FR-08-13 | Aplicar alterações de aparência em tempo real sem reiniciar a aplicação. |

## 5. Requisitos de Interface

| ID | Requisito |
| :--- | :--- |
| UI-08-01 | Modal acessível via engrenagem no canto superior direito, em qualquer tela. |
| UI-08-02 | Seções organizadas: Aparência, Áudio, Tradução, Estudo, Cache, Sobre. |
| UI-08-03 | Controles: select, toggle, slider (velocidade de áudio), botão (limpar cache). |
| UI-08-04 | Feedback visual ao salvar alterações. |

## 6. Requisitos de Dados

| ID | Requisito |
| :--- | :--- |
| DR-08-01 | Tabela de preferências (`app_config`) com chave/valor (ex.: `font_size`, `theme`, `tts_speed`, `tts_voice`, `target_lang`, `auto_translate`, `study_mode`, `flashcards_per_paragraph`). |
| DR-08-02 | Persistência imediata a cada alteração (ou no fechamento, conforme decisão de implementação). |

## 7. Tratamento de Erros

| ID | Erro | Mensagem / Ação |
| :--- | :--- | :--- |
| ER-08-01 | Falha ao persistir configurações | Exibir aviso e manter valores anteriores. |
| ER-08-02 | Voz selecionada indisponível | Usar voz padrão e informar o usuário. |

## 8. Critérios de Aceite

- [ ] Todas as seções listadas estão presentes no modal.
- [ ] Mudanças de fonte/tema são aplicadas em tempo real.
- [ ] Velocidade de TTS é aplicada à reprodução (0.5x–2.0x).
- [ ] "Mostrar Tradução Automática" desligada desativa o tooltip de hover.
- [ ] Preferências persistem entre sessões da aplicação.

## 9. Dependências

- SQLite (preferências), configurações do TTS (`piper-rs`), tema do frontend (React).
