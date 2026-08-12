import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addLearnedWord,
  getParagraphAudio,
  getParagraphNikud,
  getReadingContext,
  getWordAudio,
  getWordTranslation,
  setProgress,
} from "../api";
import { useI18n } from "../i18n";
import { useSettings } from "../settings";
import type { ArticleDetail } from "../types";

interface Props {
  article: ArticleDetail;
  onBack: () => void;
  onProgress: () => void;
  onPractice: (paragraphIndex: number) => void;
}

interface WordToken {
  key: number;
  text: string;
  clean: string;
  isSpace: boolean;
}

interface Popover {
  key: number;
  word: string;
  x: number;
  y: number;
}

const WORD_PUNCT = /[.,;:!?()"'«»]/g;

function splitWords(text: string): WordToken[] {
  return text.split(" ").map((tok, i) => ({
    key: i,
    text: tok,
    clean: tok.replace(WORD_PUNCT, ""),
    isSpace: tok.trim() === "",
  }));
}

function urlFromB64(dataB64: string): string {
  const bin = atob(dataB64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export default function ReadingScreen({
  article,
  onBack,
  onProgress,
  onPractice,
}: Props) {
  const { t, lang } = useI18n();
  const { prefs } = useSettings();
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [nikudMap, setNikudMap] = useState<Record<number, string>>({});
  const [nikudLoading, setNikudLoading] = useState(false);
  const [nikudWarning, setNikudWarning] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeWordKey, setActiveWordKey] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [flashcardAdded, setFlashcardAdded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIndexRef = useRef(-1);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const percent = useMemo(() => {
    if (total === 0) return 0;
    return Math.round(((currentIndex + 1) / total) * 100);
  }, [currentIndex, total]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const playBytes = useCallback(
    (dataB64: string) => {
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return urlFromB64(dataB64);
      });
      setPlaying(true);
    },
    [],
  );

  // Toca quando o `src` do <audio> é aplicado pelo React.
  useEffect(() => {
    if (audioUrl) {
      const el = audioRef.current;
      if (el) {
        // FR-08-03: velocidade de reprodução configurada (0.5×–2.0×).
        el.playbackRate = prefs.tts_speed;
        el.play().catch(() => {
          showNotice(t("reading.audioPlayFailed"));
          setPlaying(false);
        });
      }
    }
  }, [audioUrl, prefs.tts_speed, showNotice, t]);

  useEffect(() => {
    let cancelled = false;
    getReadingContext(article.article_id)
      .then((r) => {
        if (cancelled) return;
        setParagraphs(r.paragraphs);
        setCurrentIndex(r.current_paragraph_index);
        setTotal(r.total_paragraphs);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [article.article_id]);

  const loadNikud = useCallback(
    (index: number) => {
      const text = paragraphs[index];
      if (text === undefined || nikudMap[index] !== undefined) return;
      requestIndexRef.current = index;
      setNikudLoading(true);
      setNikudWarning(false);
      getParagraphNikud(article.article_id, index)
        .then((r) => {
          if (requestIndexRef.current !== index) return;
          setNikudMap((m) => ({ ...m, [index]: r.text }));
          if (!r.nikud_applied) setNikudWarning(true);
        })
        .catch(() => {
          if (requestIndexRef.current !== index) return;
          setNikudMap((m) => ({ ...m, [index]: text }));
          setNikudWarning(true);
        })
        .finally(() => {
          if (requestIndexRef.current === index) setNikudLoading(false);
        });
    },
    [article.article_id, nikudMap, paragraphs],
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphs.length) return;
      setCurrentIndex(index);
      requestIndexRef.current = index;
      setAudioUrl(null);
      setActiveWordKey(null);
      setPopover(null);
      setPlaying(false);
      setProgress(article.article_id, index).then(onProgress).catch(() => {
        // ER-03-03: falha ao persistir progresso é não bloqueante.
      });
      loadNikud(index);
    },
    [article.article_id, loadNikud, onProgress, paragraphs.length],
  );

  useEffect(() => {
    if (paragraphs.length > 0) loadNikud(currentIndex);
  }, [paragraphs, currentIndex, loadNikud]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [audioUrl]);

  const playParagraph = useCallback(() => {
    getParagraphAudio(article.article_id, currentIndex)
      .then((r) => {
        setActiveWordKey(null);
        playBytes(r.data_b64);
      })
      .catch(() => {
        // ER-03-02: áudio indisponível no momento → mensagem não bloqueante.
        showNotice(t("reading.audioUnavailable"));
      });
  }, [article.article_id, currentIndex, playBytes, showNotice, t]);

  const playWord = useCallback(
    (word: string, key: number) => {
      setActiveWordKey(key);
      getWordAudio(word)
        .then((r) => playBytes(r.data_b64))
        .catch(() => {
          setActiveWordKey(null);
          showNotice(t("reading.audioWordUnavailable"));
        });
    },
    [playBytes, showNotice, t],
  );

  const onWordClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, w: WordToken) => {
      if (!w.clean) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(
        110,
        Math.min(rect.left + rect.width / 2, window.innerWidth - 110),
      );
      setPopover({ key: w.key, word: w.clean, x, y: rect.top });
      setTranslation(null);
      setFlashcardAdded(false);
    },
    [],
  );

  const closePopover = useCallback(() => {
    setPopover(null);
    setTranslation(null);
  }, []);

  const doTranslate = useCallback(() => {
    if (!popover || translation !== null) return;
    setTranslating(true);
    getWordTranslation(popover.word, lang)
      .then(setTranslation)
      .catch((e) => {
        const msg = String(e);
        setTranslation(
          msg.includes("indisponível")
            ? t("reading.translationServiceDown")
            : t("reading.translationUnavailable"),
        );
      })
      .finally(() => setTranslating(false));
  }, [lang, popover, t, translation]);

  // FR-08-06: "Mostrar Tradução Automática" — traduz ao abrir o popover.
  useEffect(() => {
    if (popover && prefs.auto_translate) doTranslate();
  }, [popover, prefs.auto_translate, doTranslate]);

  const doAddFlashcard = useCallback(() => {
    if (!popover || !translation || flashcardAdded) return;
    addLearnedWord(popover.word, translation)
      .then((added) => {
        setFlashcardAdded(added || true);
        if (!added) showNotice(t("reading.alreadyInFlashcards"));
      })
      .catch(() => showNotice(t("reading.addFlashcardFailed")));
  }, [flashcardAdded, popover, showNotice, t, translation]);

  if (loadError) {
    return (
      <section className="reading-screen">
        <button className="back-button" onClick={onBack}>
          {t("common.backToSearch")}
        </button>
        <div className="status-card error-card">
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= paragraphs.length - 1;
  const displayText = nikudMap[currentIndex];
  const words = displayText !== undefined ? splitWords(displayText) : [];

  return (
    <section className="reading-screen">
      <header className="reading-header">
        <button className="back-button" onClick={onBack}>
          {t("common.backToSearch")}
        </button>
        <div className="reading-heading">
          <h2 className="reading-title" lang="he">
            {article.title_he}
          </h2>
          <p className="muted">{article.title}</p>
        </div>
        <span className="progress-indicator">
          {t("reading.progress", {
            current: currentIndex + 1,
            total,
            percent,
          })}
        </span>
      </header>

      <div className="reading-body">
        <div className="paragraph current" lang="he" dir="rtl">
          {nikudLoading && displayText === undefined ? (
            <div className="nikud-spinner">
              <span className="spinner" aria-hidden="true" />
              <span className="muted">{t("reading.preparing")}</span>
            </div>
          ) : (
            words.map((w) =>
              w.isSpace ? (
                <span key={w.key}> </span>
              ) : (
                <span
                  key={w.key}
                  className={`word ${activeWordKey === w.key ? "playing" : ""}`}
                  title={t("reading.wordTitle")}
                  onClick={(e) => onWordClick(e, w)}
                >
                  {w.text}
                </span>
              ),
            )
          )}
        </div>

        {nikudWarning && (
          <p className="warning">{t("reading.nikudWarning")}</p>
        )}
        {notice && <p className="warning">{notice}</p>}
        <p className="word-hint">{t("reading.wordHint")}</p>
        {prefs.study_mode === "full" && (
          <button
            className="practice-button"
            onClick={() => onPractice(currentIndex)}
          >
            {t("reading.practice")}
          </button>
        )}
      </div>

      {popover && (
        <div
          className="word-popover"
          style={{ left: popover.x, top: popover.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="popover-close"
            onClick={closePopover}
            title={t("reading.close")}
          >
            ×
          </button>
          <span className="popover-word" lang="he" dir="rtl">
            {popover.word}
          </span>
          <div className="popover-actions">
            <button
              className="popover-btn"
              onClick={() => playWord(popover.word, popover.key)}
            >
              {t("reading.listen")}
            </button>
            <button
              className="popover-btn"
              onClick={doTranslate}
              disabled={translating}
            >
              {translating ? t("reading.translating") : t("reading.translate")}
            </button>
          </div>
          {translation !== null && (
            <div className="popover-translation">
              <span className="popover-translation-text">
                {popover.word} = {translation}
              </span>
              <button
                className="popover-btn small"
                onClick={doAddFlashcard}
                disabled={flashcardAdded}
              >
                {flashcardAdded
                  ? t("reading.inFlashcards")
                  : t("reading.addFlashcard")}
              </button>
            </div>
          )}
        </div>
      )}

      <footer className="reading-footer">
        <div className="audio-controls">
          <button
            className="audio-button"
            onClick={playParagraph}
            title={t("reading.listenTitle")}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <span className="muted">
            {playing ? t("reading.playing") : t("reading.listenParagraph")}
          </span>
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setActiveWordKey(null);
            }}
          />
        </div>

        <div className="nav-arrows">
          <button
            className="nav-button"
            onClick={() => goTo(currentIndex - 1)}
            disabled={isFirst}
            title={t("reading.prevTitle")}
          >
            ←
          </button>
          <button
            className="nav-button"
            onClick={() => goTo(currentIndex + 1)}
            disabled={isLast}
            title={t("reading.nextTitle")}
          >
            →
          </button>
        </div>
      </footer>
    </section>
  );
}
