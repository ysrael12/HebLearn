import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getUiConfig, setUiLang } from "./api";

// Spec 11 — dicionários da interface (pt-BR é o idioma padrão/fallback).
// O idioma de aprendizagem é fixo em hebraico; estes dicionários cobrem
// apenas os textos da UI.

const ptBR = {
  "onboarding.title": "Escolha o idioma",
  "onboarding.subtitle":
    "O conteúdo de aprendizado é sempre em hebraico. Este idioma é usado na interface, na busca de artigos e nas traduções.",
  "onboarding.continue": "Continuar",
  "onboarding.saving": "Salvando...",
  "welcome.subtitle":
    "Aprenda hebraico lendo artigos da Wikipédia — com vogais, áudio, tradução e flashcards.",
  "welcome.start": "Iniciar Nova Leitura",
  "welcome.continue": "Continuar Leitura",
  "welcome.stats": "Estatísticas de Aprendizado",
  "welcome.noProgress": "Nenhuma leitura em andamento.",
  "stats.title": "Estatísticas de Aprendizado",
  "stats.comingSoon":
    "Em breve: aqui você verá seu progresso — artigos lidos, palavras aprendidas e tempo de estudo.",
  "stats.back": "← Voltar",
  "settings.title": "Configurações",
  "settings.close": "Fechar",
  "settings.appearance": "Aparência",
  "settings.fontSize": "Tamanho da fonte",
  "settings.fontSmall": "Pequeno",
  "settings.fontMedium": "Médio",
  "settings.fontLarge": "Grande",
  "settings.theme": "Tema",
  "settings.themeLight": "Claro",
  "settings.themeDark": "Escuro",
  "settings.themeAuto": "Automático",
  "settings.audio": "Áudio",
  "settings.ttsSpeed": "Velocidade de reprodução",
  "settings.ttsVoice": "Voz",
  "settings.voiceDefault": "Padrão",
  "settings.voiceNote":
    "Por enquanto há apenas a voz padrão do modelo embutido.",
  "settings.translation": "Tradução",
  "settings.targetLang": "Idioma alvo das traduções",
  "settings.targetLangNote":
    "Segue o idioma da interface (troque no seletor de idioma da barra lateral).",
  "settings.autoTranslate": "Mostrar tradução automaticamente",
  "settings.autoTranslateNote": "Traduz a palavra assim que você clica nela.",
  "settings.study": "Estudo",
  "settings.studyMode": "Modo de estudo",
  "settings.studyFull": "Leitura + Flashcards",
  "settings.studyReadingOnly": "Apenas Leitura",
  "settings.flashcardsPerParagraph": "Máximo de flashcards por parágrafo",
  "settings.cache": "Cache",
  "settings.cacheNikud": "Nikud",
  "settings.cacheAudio": "Áudio",
  "settings.cacheTranslations": "Traduções",
  "settings.cacheImages": "Imagens",
  "settings.cacheTotal": "Total",
  "settings.cacheFailed": "Não foi possível ler o cache.",
  "settings.clearCache": "Limpar Cache",
  "settings.clearCacheConfirm": "Clique novamente para confirmar",
  "settings.clearingCache": "Limpando...",
  "settings.about": "Sobre",
  "settings.version": "Versão",
  "settings.licenses":
    "Tecnologias: Tauri, React, SQLite, nakdimon, piper-tts, ONNX Runtime, APIs da Wikipédia, LibreTranslate e MyMemory.",
  "settings.saved": "Alterações salvas automaticamente.",
  "settings.saveFailed":
    "Não foi possível salvar. Os valores anteriores foram mantidos.",
  "search.title": "Buscar Artigo",
  "search.note":
    "Digite o título do artigo para buscar a versão em hebraico.",
  "search.placeholder": "Digite o nome do artigo...",
  "search.aria": "Título do artigo",
  "search.button": "Buscar",
  "search.searching": "Buscando...",
  "search.suggestions": "Buscando sugestões...",
  "search.loading": "Carregando resultados...",
  "search.empty": "Nenhum artigo encontrado. Tente outra busca.",
  "search.downloading": "Baixando versão em hebraico...",
  "common.backToSearch": "← Buscar",
  "common.backToArticle": "← Voltar ao artigo",
  "common.home": "⌂ Início",
  "reading.progress": "Parágrafo {current} de {total} | {percent}% do artigo lido",
  "reading.preparing": "Preparando texto...",
  "reading.wordHint": "Clique em uma palavra para ouvi-la ou traduzir.",
  "reading.wordTitle": "Clique para ver opções",
  "reading.practice": "Praticar Vocabulário",
  "reading.nikudWarning":
    "Serviço de nikud indisponível — exibindo texto sem vogais.",
  "reading.audioUnavailable":
    "Áudio não está disponível no momento. Tente novamente.",
  "reading.audioWordUnavailable": "Áudio não disponível para esta palavra.",
  "reading.audioPlayFailed": "Não foi possível reproduzir o áudio.",
  "reading.translating": "Traduzindo...",
  "reading.translate": "→ Traduzir",
  "reading.listen": "▶ Ouvir",
  "reading.close": "Fechar",
  "reading.translationUnavailable": "Tradução não disponível.",
  "reading.translationServiceDown":
    "Serviço de tradução indisponível no momento. Tente novamente mais tarde.",
  "reading.addFlashcard": "Adicionar aos Flashcards",
  "reading.inFlashcards": "✓ Nos flashcards",
  "reading.alreadyInFlashcards": "Palavra já estava nos flashcards.",
  "reading.addFlashcardFailed": "Falha ao adicionar aos flashcards.",
  "reading.playing": "Reproduzindo",
  "reading.listenParagraph": "Ouvir parágrafo",
  "reading.listenTitle": "Ouvir o parágrafo inteiro",
  "reading.prevTitle": "Parágrafo anterior",
  "reading.nextTitle": "Próximo parágrafo",
  "flashcards.subtitle": "Praticar vocabulário · parágrafo {paragraph}",
  "flashcards.progress":
    "Palavra {current} de {total} · {learned} aprendidas",
  "flashcards.learned": "Aprendida",
  "flashcards.new": "Nova",
  "flashcards.flipHint": "Clique para ver a tradução",
  "flashcards.translationBadge": "Tradução",
  "flashcards.translating": "Traduzindo...",
  "flashcards.noTranslation": "Tradução não disponível.",
  "flashcards.emptyTitle": "Nenhuma palavra nova neste parágrafo.",
  "flashcards.emptyHint": "Continue lendo para praticar mais palavras.",
  "flashcards.audioUnavailable": "Áudio indisponível para esta palavra.",
  "flashcards.audioPlayFailed": "Não foi possível reproduzir o áudio.",
  "flashcards.markedLearned": "Palavra marcada como aprendida.",
  "flashcards.markedReview": "Palavra adicionada para revisão.",
  "flashcards.saveFailed": "Falha ao salvar. Tente novamente.",
  "flashcards.learnedAction": "✓ Aprendi",
  "flashcards.reviewAction": "↻ Repetir",
  "flashcards.flipToSee": "Vire o cartão para ver a tradução",
  "flashcards.prevTitle": "Anterior",
  "flashcards.nextTitle": "Próximo",
  "flashcards.noImage": "Sem imagem",
  "flashcards.listenTitle": "Ouvir a palavra",
  "sidebar.title": "Continuar Leitura",
  "sidebar.empty1": "Nenhum artigo aberto ainda.",
  "sidebar.empty2": "Busque um artigo para começar.",
  "sidebar.completed": "Concluído",
  "sidebar.paragraphOf": "Parágrafo {current} de {total} · {percent}%",
  "sidebar.confirmDelete": "Clique novamente para excluir",
  "sidebar.delete": "Excluir artigo",
  "sidebar.confirm": "Confirmar?",
  "sidebar.language": "Idioma",
} satisfies Record<string, string>;

export type TranslationKey = keyof typeof ptBR;

const en: Record<TranslationKey, string> = {
  "onboarding.title": "Choose the language",
  "onboarding.subtitle":
    "Learning content is always in Hebrew. This language is used for the interface, article search and translations.",
  "onboarding.continue": "Continue",
  "onboarding.saving": "Saving...",
  "welcome.subtitle":
    "Learn Hebrew by reading Wikipedia articles — with vowels, audio, translation and flashcards.",
  "welcome.start": "Start New Reading",
  "welcome.continue": "Continue Reading",
  "welcome.stats": "Learning Statistics",
  "welcome.noProgress": "No reading in progress.",
  "stats.title": "Learning Statistics",
  "stats.comingSoon":
    "Coming soon: here you'll see your progress — articles read, words learned and study time.",
  "stats.back": "← Back",
  "settings.title": "Settings",
  "settings.close": "Close",
  "settings.appearance": "Appearance",
  "settings.fontSize": "Font size",
  "settings.fontSmall": "Small",
  "settings.fontMedium": "Medium",
  "settings.fontLarge": "Large",
  "settings.theme": "Theme",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.themeAuto": "Automatic",
  "settings.audio": "Audio",
  "settings.ttsSpeed": "Playback speed",
  "settings.ttsVoice": "Voice",
  "settings.voiceDefault": "Default",
  "settings.voiceNote":
    "For now only the default voice of the bundled model is available.",
  "settings.translation": "Translation",
  "settings.targetLang": "Translation target language",
  "settings.targetLangNote":
    "Follows the interface language (change it in the sidebar language selector).",
  "settings.autoTranslate": "Show translation automatically",
  "settings.autoTranslateNote": "Translates the word as soon as you click it.",
  "settings.study": "Study",
  "settings.studyMode": "Study mode",
  "settings.studyFull": "Reading + Flashcards",
  "settings.studyReadingOnly": "Reading only",
  "settings.flashcardsPerParagraph": "Max flashcards per paragraph",
  "settings.cache": "Cache",
  "settings.cacheNikud": "Nikud",
  "settings.cacheAudio": "Audio",
  "settings.cacheTranslations": "Translations",
  "settings.cacheImages": "Images",
  "settings.cacheTotal": "Total",
  "settings.cacheFailed": "Could not read the cache.",
  "settings.clearCache": "Clear Cache",
  "settings.clearCacheConfirm": "Click again to confirm",
  "settings.clearingCache": "Clearing...",
  "settings.about": "About",
  "settings.version": "Version",
  "settings.licenses":
    "Technologies: Tauri, React, SQLite, nakdimon, piper-tts, ONNX Runtime, Wikipedia APIs, LibreTranslate and MyMemory.",
  "settings.saved": "Changes saved automatically.",
  "settings.saveFailed": "Could not save. Previous values were kept.",
  "search.title": "Search Article",
  "search.note": "Type the article title to find its Hebrew version.",
  "search.placeholder": "Type the article name...",
  "search.aria": "Article title",
  "search.button": "Search",
  "search.searching": "Searching...",
  "search.suggestions": "Looking for suggestions...",
  "search.loading": "Loading results...",
  "search.empty": "No articles found. Try another search.",
  "search.downloading": "Downloading Hebrew version...",
  "common.backToSearch": "← Search",
  "common.backToArticle": "← Back to article",
  "common.home": "⌂ Home",
  "reading.progress": "Paragraph {current} of {total} | {percent}% of article read",
  "reading.preparing": "Preparing text...",
  "reading.wordHint": "Click a word to hear it or translate.",
  "reading.wordTitle": "Click for options",
  "reading.practice": "Practice Vocabulary",
  "reading.nikudWarning": "Nikud service unavailable — showing text without vowels.",
  "reading.audioUnavailable": "Audio is not available right now. Try again.",
  "reading.audioWordUnavailable": "Audio not available for this word.",
  "reading.audioPlayFailed": "Could not play the audio.",
  "reading.translating": "Translating...",
  "reading.translate": "→ Translate",
  "reading.listen": "▶ Listen",
  "reading.close": "Close",
  "reading.translationUnavailable": "Translation not available.",
  "reading.translationServiceDown":
    "Translation service is unavailable right now. Try again later.",
  "reading.addFlashcard": "Add to Flashcards",
  "reading.inFlashcards": "✓ In flashcards",
  "reading.alreadyInFlashcards": "Word was already in flashcards.",
  "reading.addFlashcardFailed": "Failed to add to flashcards.",
  "reading.playing": "Playing",
  "reading.listenParagraph": "Listen to paragraph",
  "reading.listenTitle": "Listen to the whole paragraph",
  "reading.prevTitle": "Previous paragraph",
  "reading.nextTitle": "Next paragraph",
  "flashcards.subtitle": "Practice vocabulary · paragraph {paragraph}",
  "flashcards.progress": "Word {current} of {total} · {learned} learned",
  "flashcards.learned": "Learned",
  "flashcards.new": "New",
  "flashcards.flipHint": "Click to see the translation",
  "flashcards.translationBadge": "Translation",
  "flashcards.translating": "Translating...",
  "flashcards.noTranslation": "Translation not available.",
  "flashcards.emptyTitle": "No new words in this paragraph.",
  "flashcards.emptyHint": "Keep reading to practice more words.",
  "flashcards.audioUnavailable": "Audio not available for this word.",
  "flashcards.audioPlayFailed": "Could not play the audio.",
  "flashcards.markedLearned": "Word marked as learned.",
  "flashcards.markedReview": "Word added for review.",
  "flashcards.saveFailed": "Failed to save. Try again.",
  "flashcards.learnedAction": "✓ Learned",
  "flashcards.reviewAction": "↻ Repeat",
  "flashcards.flipToSee": "Flip the card to see the translation",
  "flashcards.prevTitle": "Previous",
  "flashcards.nextTitle": "Next",
  "flashcards.noImage": "No image",
  "flashcards.listenTitle": "Listen to the word",
  "sidebar.title": "Continue Reading",
  "sidebar.empty1": "No articles opened yet.",
  "sidebar.empty2": "Search for an article to start.",
  "sidebar.completed": "Completed",
  "sidebar.paragraphOf": "Paragraph {current} of {total} · {percent}%",
  "sidebar.confirmDelete": "Click again to delete",
  "sidebar.delete": "Delete article",
  "sidebar.confirm": "Confirm?",
  "sidebar.language": "Language",
};

const es: Record<TranslationKey, string> = {
  "onboarding.title": "Elige el idioma",
  "onboarding.subtitle":
    "El contenido de aprendizaje siempre está en hebreo. Este idioma se usa en la interfaz, la búsqueda de artículos y las traducciones.",
  "onboarding.continue": "Continuar",
  "onboarding.saving": "Guardando...",
  "welcome.subtitle":
    "Aprende hebreo leyendo artículos de Wikipedia — con vocales, audio, traducción y flashcards.",
  "welcome.start": "Iniciar Nueva Lectura",
  "welcome.continue": "Continuar Leyendo",
  "welcome.stats": "Estadísticas de Aprendizaje",
  "welcome.noProgress": "No hay ninguna lectura en curso.",
  "stats.title": "Estadísticas de Aprendizaje",
  "stats.comingSoon":
    "Próximamente: aquí verás tu progreso — artículos leídos, palabras aprendidas y tiempo de estudio.",
  "stats.back": "← Volver",
  "settings.title": "Configuración",
  "settings.close": "Cerrar",
  "settings.appearance": "Apariencia",
  "settings.fontSize": "Tamaño de fuente",
  "settings.fontSmall": "Pequeño",
  "settings.fontMedium": "Mediano",
  "settings.fontLarge": "Grande",
  "settings.theme": "Tema",
  "settings.themeLight": "Claro",
  "settings.themeDark": "Oscuro",
  "settings.themeAuto": "Automático",
  "settings.audio": "Audio",
  "settings.ttsSpeed": "Velocidad de reproducción",
  "settings.ttsVoice": "Voz",
  "settings.voiceDefault": "Predeterminada",
  "settings.voiceNote":
    "Por ahora solo está disponible la voz predeterminada del modelo incluido.",
  "settings.translation": "Traducción",
  "settings.targetLang": "Idioma de destino de las traducciones",
  "settings.targetLangNote":
    "Sigue el idioma de la interfaz (cámbialo en el selector de idioma de la barra lateral).",
  "settings.autoTranslate": "Mostrar traducción automáticamente",
  "settings.autoTranslateNote": "Traduce la palabra en cuanto haces clic en ella.",
  "settings.study": "Estudio",
  "settings.studyMode": "Modo de estudio",
  "settings.studyFull": "Lectura + Flashcards",
  "settings.studyReadingOnly": "Solo lectura",
  "settings.flashcardsPerParagraph": "Máximo de flashcards por párrafo",
  "settings.cache": "Caché",
  "settings.cacheNikud": "Nikud",
  "settings.cacheAudio": "Audio",
  "settings.cacheTranslations": "Traducciones",
  "settings.cacheImages": "Imágenes",
  "settings.cacheTotal": "Total",
  "settings.cacheFailed": "No se pudo leer la caché.",
  "settings.clearCache": "Limpiar caché",
  "settings.clearCacheConfirm": "Clic de nuevo para confirmar",
  "settings.clearingCache": "Limpiando...",
  "settings.about": "Acerca de",
  "settings.version": "Versión",
  "settings.licenses":
    "Tecnologías: Tauri, React, SQLite, nakdimon, piper-tts, ONNX Runtime, APIs de Wikipedia, LibreTranslate y MyMemory.",
  "settings.saved": "Cambios guardados automáticamente.",
  "settings.saveFailed": "No se pudo guardar. Se conservaron los valores anteriores.",
  "search.title": "Buscar Artículo",
  "search.note":
    "Escribe el título del artículo para buscar su versión en hebreo.",
  "search.placeholder": "Escribe el nombre del artículo...",
  "search.aria": "Título del artículo",
  "search.button": "Buscar",
  "search.searching": "Buscando...",
  "search.suggestions": "Buscando sugerencias...",
  "search.loading": "Cargando resultados...",
  "search.empty": "No se encontraron artículos. Intenta otra búsqueda.",
  "search.downloading": "Descargando versión en hebreo...",
  "common.backToSearch": "← Buscar",
  "common.backToArticle": "← Volver al artículo",
  "common.home": "⌂ Inicio",
  "reading.progress":
    "Párrafo {current} de {total} | {percent}% del artículo leído",
  "reading.preparing": "Preparando texto...",
  "reading.wordHint": "Haz clic en una palabra para escucharla o traducirla.",
  "reading.wordTitle": "Clic para ver opciones",
  "reading.practice": "Practicar Vocabulario",
  "reading.nikudWarning":
    "Servicio de nikud no disponible: mostrando texto sin vocales.",
  "reading.audioUnavailable": "El audio no está disponible ahora. Inténtalo de nuevo.",
  "reading.audioWordUnavailable": "Audio no disponible para esta palabra.",
  "reading.audioPlayFailed": "No se pudo reproducir el audio.",
  "reading.translating": "Traduciendo...",
  "reading.translate": "→ Traducir",
  "reading.listen": "▶ Escuchar",
  "reading.close": "Cerrar",
  "reading.translationUnavailable": "Traducción no disponible.",
  "reading.translationServiceDown":
    "El servicio de traducción no está disponible ahora. Inténtalo más tarde.",
  "reading.addFlashcard": "Añadir a Flashcards",
  "reading.inFlashcards": "✓ En flashcards",
  "reading.alreadyInFlashcards": "La palabra ya estaba en los flashcards.",
  "reading.addFlashcardFailed": "Error al añadir a los flashcards.",
  "reading.playing": "Reproduciendo",
  "reading.listenParagraph": "Escuchar párrafo",
  "reading.listenTitle": "Escuchar el párrafo completo",
  "reading.prevTitle": "Párrafo anterior",
  "reading.nextTitle": "Siguiente párrafo",
  "flashcards.subtitle": "Practicar vocabulario · párrafo {paragraph}",
  "flashcards.progress": "Palabra {current} de {total} · {learned} aprendidas",
  "flashcards.learned": "Aprendida",
  "flashcards.new": "Nueva",
  "flashcards.flipHint": "Clic para ver la traducción",
  "flashcards.translationBadge": "Traducción",
  "flashcards.translating": "Traduciendo...",
  "flashcards.noTranslation": "Traducción no disponible.",
  "flashcards.emptyTitle": "No hay palabras nuevas en este párrafo.",
  "flashcards.emptyHint": "Sigue leyendo para practicar más palabras.",
  "flashcards.audioUnavailable": "Audio no disponible para esta palabra.",
  "flashcards.audioPlayFailed": "No se pudo reproducir el audio.",
  "flashcards.markedLearned": "Palabra marcada como aprendida.",
  "flashcards.markedReview": "Palabra añadida para repasar.",
  "flashcards.saveFailed": "Error al guardar. Inténtalo de nuevo.",
  "flashcards.learnedAction": "✓ Aprendí",
  "flashcards.reviewAction": "↻ Repetir",
  "flashcards.flipToSee": "Gira la tarjeta para ver la traducción",
  "flashcards.prevTitle": "Anterior",
  "flashcards.nextTitle": "Siguiente",
  "flashcards.noImage": "Sin imagen",
  "flashcards.listenTitle": "Escuchar la palabra",
  "sidebar.title": "Continuar Leyendo",
  "sidebar.empty1": "Aún no hay artículos abiertos.",
  "sidebar.empty2": "Busca un artículo para empezar.",
  "sidebar.completed": "Completado",
  "sidebar.paragraphOf": "Párrafo {current} de {total} · {percent}%",
  "sidebar.confirmDelete": "Clic de nuevo para eliminar",
  "sidebar.delete": "Eliminar artículo",
  "sidebar.confirm": "¿Confirmar?",
  "sidebar.language": "Idioma",
};

export type Language = keyof typeof translations;

export const translations = {
  "pt-BR": ptBR,
  en,
  es,
};

export interface LanguageOption {
  code: Language;
  nativeName: string;
  preview: string;
}

export const languageOptions: LanguageOption[] = [
  {
    code: "pt-BR",
    nativeName: "Português",
    preview: "Buscar Artigo · Continuar Leitura",
  },
  {
    code: "en",
    nativeName: "English",
    preview: "Search Article · Continue Reading",
  },
  {
    code: "es",
    nativeName: "Español",
    preview: "Buscar Artículo · Continuar Leyendo",
  },
];

export type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

interface I18nValue {
  lang: Language;
  ready: boolean;
  firstRun: boolean;
  t: TranslateFn;
  setLang: (lang: Language) => Promise<void>;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("pt-BR");
  const [ready, setReady] = useState(false);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUiConfig()
      .then((cfg) => {
        if (cancelled) return;
        setLangState(
          cfg.ui_lang in translations ? (cfg.ui_lang as Language) : "pt-BR",
        );
        setFirstRun(cfg.first_run);
        setReady(true);
      })
      .catch(() => {
        // ER-11-03: falha ao carregar dicionário → fallback pt-BR, não bloquear.
        if (cancelled) return;
        setFirstRun(false);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback(async (next: Language) => {
    setLangState(next);
    setFirstRun(false);
    try {
      await setUiLang(next);
    } catch {
      // ER-11-01: falha ao persistir → idioma continua aplicado na sessão.
    }
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      let s = translations[lang][key] ?? translations["pt-BR"][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, ready, firstRun, t, setLang }),
    [lang, ready, firstRun, t, setLang],
  );

  // UI sempre LTR; o conteúdo hebraico mantém `lang="he" dir="rtl"` inline.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n deve ser usado dentro de I18nProvider");
  return ctx;
}
