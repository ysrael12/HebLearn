export interface ArticlePreview {
  title: string;
  summary: string;
}

export interface ArticleDetail {
  article_id: number;
  title_he: string;
  title: string;
  url: string;
  paragraph_count: number;
}

export interface ReadingContext {
  article: ArticleDetail;
  paragraphs: string[];
  current_paragraph_index: number;
  total_paragraphs: number;
  completed: boolean;
}

export interface NikudResult {
  text: string;
  nikud_applied: boolean;
}

export interface AudioResult {
  data_b64: string;
  from_cache: boolean;
}

export interface ReadingHistoryItem {
  article_id: number;
  title_he: string;
  title: string;
  current_paragraph_index: number;
  total_paragraphs: number;
  completed: boolean;
}

export interface Flashcard {
  word_he: string;
  word_nikud: string;
  learned: boolean;
}

export interface Prefs {
  font_size: "small" | "medium" | "large";
  theme: "light" | "dark" | "auto";
  tts_speed: number;
  tts_voice: string;
  auto_translate: boolean;
  study_mode: "full" | "reading";
  flashcards_per_paragraph: number;
}

export interface CacheStats {
  nikud_bytes: number;
  audio_bytes: number;
  translation_bytes: number;
  image_bytes: number;
  total_bytes: number;
}

export interface AppInfo {
  name: string;
  version: string;
  spec_version: string;
}
