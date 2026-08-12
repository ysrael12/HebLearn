import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getFlashcards,
  getWordAudio,
  getWordImage,
  getWordTranslation,
  markWord,
} from "../api";
import { useI18n } from "../i18n";
import { useSettings } from "../settings";
import type { ArticleDetail, Flashcard } from "../types";

interface Props {
  article: ArticleDetail;
  paragraphIndex: number;
  onBack: () => void;
}

interface CardState {
  imageUrl: string | null;
  imageLoading: boolean;
  translation: string | null;
  translating: boolean;
  flipped: boolean;
}

function urlFromB64(dataB64: string): string {
  const bin = atob(dataB64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export default function FlashcardsScreen({
  article,
  paragraphIndex,
  onBack,
}: Props) {
  const { t, lang } = useI18n();
  const { prefs } = useSettings();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [cardState, setCardState] = useState<Record<number, CardState>>({});
  const [learnedMap, setLearnedMap] = useState<Record<string, boolean>>({});
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestedImagesRef = useRef<Set<number>>(new Set());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFlashcards(article.article_id, paragraphIndex)
      .then((c) => {
        if (cancelled) return;
        // FR-08-08: limite de flashcards por parágrafo.
        const limited = c.slice(0, prefs.flashcards_per_paragraph);
        setCards(limited);
        setIndex(0);
        const learned: Record<string, boolean> = {};
        for (const card of limited) learned[card.word_he] = card.learned;
        setLearnedMap(learned);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [article.article_id, paragraphIndex, prefs.flashcards_per_paragraph]);

  useEffect(() => {
    if (cards.length === 0 || requestedImagesRef.current.has(index)) return;
    const card = cards[index];
    if (!card) return;
    requestedImagesRef.current.add(index);
    setCardState((prev) => ({
      ...prev,
      [index]: {
        imageUrl: null,
        imageLoading: true,
        translation: null,
        translating: false,
        flipped: false,
      },
    }));
    getWordImage(card.word_he, lang)
      .then((url) => {
        setCardState((prev) => ({
          ...prev,
          [index]: { ...prev[index], imageUrl: url, imageLoading: false },
        }));
      })
      .catch(() => {
        setCardState((prev) => ({
          ...prev,
          [index]: { ...prev[index], imageUrl: null, imageLoading: false },
        }));
      });
  }, [cards, index, lang]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl) {
      const el = audioRef.current;
      if (el) {
        // FR-08-03: velocidade de reprodução configurada (0.5×–2.0×).
        el.playbackRate = prefs.tts_speed;
        el.play().catch(() => {
          setPlayingWord(false);
          showNotice(t("flashcards.audioPlayFailed"));
        });
      }
    }
  }, [audioUrl, prefs.tts_speed, showNotice, t]);

  const flip = useCallback(() => {
    setCardState((prev) => {
      const current = prev[index] ?? {
        imageUrl: null,
        imageLoading: false,
        translation: null,
        translating: false,
        flipped: false,
      };
      const flipped = !current.flipped;
      const next = { ...current, flipped };
      if (flipped && next.translation === null) {
        next.translating = true;
        getWordTranslation(cards[index]?.word_he ?? "", lang)
          .then((t) => {
            setCardState((p) => ({
              ...p,
              [index]: { ...p[index], translation: t, translating: false },
            }));
          })
          .catch(() => {
            setCardState((p) => ({
              ...p,
              [index]: {
                ...p[index],
                translation: t("flashcards.noTranslation"),
                translating: false,
              },
            }));
          });
      }
      return { ...prev, [index]: next };
    });
  }, [cards, index, lang, t]);

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= cards.length) return;
      setIndex(i);
    },
    [cards.length],
  );

  const playWord = useCallback(
    (word: string) => {
      getWordAudio(word)
        .then((r) => {
          setAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return urlFromB64(r.data_b64);
          });
          setPlayingWord(true);
        })
        .catch(() => showNotice(t("flashcards.audioUnavailable")));
    },
    [showNotice, t],
  );

  const doMark = useCallback(
    (learned: boolean) => {
      const card = cards[index];
      if (!card) return;
      markWord(card.word_he, learned)
        .then(() => {
          setLearnedMap((m) => ({ ...m, [card.word_he]: learned }));
          setCardState((prev) => ({
            ...prev,
            [index]: { ...prev[index], flipped: true },
          }));
          showNotice(
            learned
              ? t("flashcards.markedLearned")
              : t("flashcards.markedReview"),
          );
        })
        .catch(() => showNotice(t("flashcards.saveFailed")));
    },
    [cards, index, showNotice, t],
  );

  const learnedCount = useMemo(
    () => cards.filter((c) => learnedMap[c.word_he]).length,
    [cards, learnedMap],
  );

  if (loadError) {
    return (
      <section className="reading-screen">
        <button className="back-button" onClick={onBack}>
          {t("common.backToArticle")}
        </button>
        <div className="status-card error-card">
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section className="reading-screen">
        <button className="back-button" onClick={onBack}>
          {t("common.backToArticle")}
        </button>
        <div className="status-card">
          <p>{t("flashcards.emptyTitle")}</p>
          <p className="muted">{t("flashcards.emptyHint")}</p>
        </div>
      </section>
    );
  }

  const card = cards[index];
  const state =
    cardState[index] ?? {
      imageUrl: null,
      imageLoading: false,
      translation: null,
      translating: false,
      flipped: false,
    };

  const renderImage = () =>
    state.imageLoading ? (
      <div className="flashcard-image-placeholder">
        <span className="spinner" />
      </div>
    ) : state.imageUrl ? (
      <img
        className="flashcard-image"
        src={state.imageUrl}
        alt={card.word_he}
        loading="lazy"
      />
    ) : (
      <div className="flashcard-image-placeholder">
        <span className="muted">{t("flashcards.noImage")}</span>
      </div>
    );

  return (
    <section className="reading-screen">
      <header className="reading-header">
        <button className="back-button" onClick={onBack}>
          {t("common.backToArticle")}
        </button>
        <div className="reading-heading">
          <h2 className="reading-title" lang="he">
            {article.title_he}
          </h2>
          <p className="muted">
            {t("flashcards.subtitle", { paragraph: paragraphIndex + 1 })}
          </p>
        </div>
        <span className="progress-indicator">
          {t("flashcards.progress", {
            current: index + 1,
            total: cards.length,
            learned: learnedCount,
          })}
        </span>
      </header>

      <div className="flashcards-body">
        <div className="flashcard-scene" onClick={flip}>
          <div className={`flashcard ${state.flipped ? "flipped" : ""}`}>
            <div className="flashcard-face flashcard-front">
              <div className="flashcard-top">
                <span
                  className={`flashcard-badge ${
                    learnedMap[card.word_he] ? "learned" : "new"
                  }`}
                >
                  {learnedMap[card.word_he]
                    ? t("flashcards.learned")
                    : t("flashcards.new")}
                </span>
                <button
                  className="flashcard-audio-btn"
                  title={t("flashcards.listenTitle")}
                  onClick={(e) => {
                    e.stopPropagation();
                    playWord(card.word_he);
                  }}
                >
                  {playingWord ? "⏸" : "🔊"}
                </button>
              </div>
              <span className="flashcard-word" lang="he" dir="rtl">
                {card.word_nikud}
              </span>
              {renderImage()}
              <span className="flashcard-hint">{t("flashcards.flipHint")}</span>
            </div>
            <div className="flashcard-face flashcard-back">
              <div className="flashcard-top">
                <span className="flashcard-badge back-badge">
                  {t("flashcards.translationBadge")}
                </span>
                <button
                  className="flashcard-audio-btn"
                  title={t("flashcards.listenTitle")}
                  onClick={(e) => {
                    e.stopPropagation();
                    playWord(card.word_he);
                  }}
                >
                  {playingWord ? "⏸" : "🔊"}
                </button>
              </div>
              <span className="flashcard-word" lang="he" dir="rtl">
                {card.word_nikud}
              </span>
              {state.imageUrl && (
                <img
                  className="flashcard-image"
                  src={state.imageUrl}
                  alt={card.word_he}
                  loading="lazy"
                />
              )}
              <span className="flashcard-translation">
                {state.translating
                  ? t("flashcards.translating")
                  : state.translation ?? t("flashcards.noTranslation")}
              </span>
            </div>
          </div>
        </div>

        {notice && <p className="warning">{notice}</p>}
        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onPlay={() => setPlayingWord(true)}
          onPause={() => setPlayingWord(false)}
          onEnded={() => setPlayingWord(false)}
        />
      </div>

      <footer className="flashcards-footer">
        {state.flipped ? (
          <div className="flashcard-actions">
            <button
              className="flashcard-action learn"
              onClick={() => doMark(true)}
              disabled={learnedMap[card.word_he]}
            >
              {t("flashcards.learnedAction")}
            </button>
            <button
              className="flashcard-action review"
              onClick={() => doMark(false)}
            >
              {t("flashcards.reviewAction")}
            </button>
          </div>
        ) : (
          <span className="muted">{t("flashcards.flipToSee")}</span>
        )}

        <div className="nav-arrows">
          <button
            className="nav-button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            title={t("flashcards.prevTitle")}
          >
            ←
          </button>
          <button
            className="nav-button"
            onClick={() => goTo(index + 1)}
            disabled={index >= cards.length - 1}
            title={t("flashcards.nextTitle")}
          >
            →
          </button>
        </div>
      </footer>
    </section>
  );
}
