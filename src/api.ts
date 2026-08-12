import { invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  ArticleDetail,
  ArticlePreview,
  AudioResult,
  CacheStats,
  Flashcard,
  NikudResult,
  Prefs,
  ReadingContext,
  ReadingHistoryItem,
} from "./types";

export interface UiConfig {
  ui_lang: string;
  first_run: boolean;
}

export function getUiConfig(): Promise<UiConfig> {
  return invoke("get_ui_config");
}

export function setUiLang(uiLang: string): Promise<void> {
  return invoke("set_ui_lang", { uiLang });
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke("get_app_info");
}

export function getPrefs(): Promise<Prefs> {
  return invoke("get_prefs");
}

export function setPref(
  key: keyof Prefs,
  value: string | number | boolean,
): Promise<void> {
  return invoke("set_pref", { key, value: String(value) });
}

export function getCacheStats(): Promise<CacheStats> {
  return invoke("get_cache_stats");
}

export function clearCache(): Promise<CacheStats> {
  return invoke("clear_cache");
}

export function wikiSearch(query: string, uiLang: string): Promise<ArticlePreview[]> {
  return invoke("wiki_search", { query, uiLang });
}

export function wikiAutocomplete(query: string, uiLang: string): Promise<string[]> {
  return invoke("wiki_autocomplete", { query, uiLang });
}

export function wikiOpenArticle(ptTitle: string, uiLang: string): Promise<ArticleDetail> {
  return invoke("wiki_open_article", { ptTitle, uiLang });
}

export function getReadingContext(articleId: number): Promise<ReadingContext> {
  return invoke("get_reading_context", { articleId });
}

export function getParagraphNikud(
  articleId: number,
  paragraphIndex: number,
): Promise<NikudResult> {
  return invoke("get_paragraph_nikud", { articleId, paragraphIndex });
}

export function getParagraphAudio(
  articleId: number,
  paragraphIndex: number,
): Promise<AudioResult> {
  return invoke("get_paragraph_audio", { articleId, paragraphIndex });
}

export function getWordAudio(word: string): Promise<AudioResult> {
  return invoke("get_word_audio", { word });
}

export function getWordTranslation(word: string, uiLang: string): Promise<string> {
  return invoke("get_word_translation", { word, uiLang });
}

export function addLearnedWord(wordHe: string, wordPt: string): Promise<boolean> {
  return invoke("add_learned_word", { wordHe, wordPt });
}

export function setProgress(articleId: number, paragraphIndex: number): Promise<void> {
  return invoke("set_progress", { articleId, paragraphIndex });
}

export function getReadingHistory(): Promise<ReadingHistoryItem[]> {
  return invoke("get_reading_history");
}

export function deleteArticle(articleId: number): Promise<void> {
  return invoke("delete_article", { articleId });
}

export function getFlashcards(
  articleId: number,
  paragraphIndex: number,
): Promise<Flashcard[]> {
  return invoke("get_flashcards", { articleId, paragraphIndex });
}

export function getWordImage(word: string, uiLang: string): Promise<string> {
  return invoke("get_word_image", { word, uiLang });
}

export function markWord(wordHe: string, learned: boolean): Promise<void> {
  return invoke("mark_word", { wordHe, learned });
}
