import { useCallback, useEffect, useRef, useState } from "react";
import { getReadingHistory } from "../api";
import { languageOptions, useI18n } from "../i18n";
import type { Language } from "../i18n";
import type { ArticleDetail, ReadingHistoryItem } from "../types";

interface Props {
  onOpenArticle: (article: ArticleDetail) => void;
  onDeleteArticle: (articleId: number) => void;
  onHome: () => void;
}

export default function Sidebar({
  onOpenArticle,
  onDeleteArticle,
  onHome,
}: Props) {
  const { t, lang, setLang } = useI18n();
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getReadingHistory()
      .then(setHistory)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const armDelete = useCallback((articleId: number) => {
    if (confirmingId === articleId) {
      onDeleteArticle(articleId);
      setConfirmingId(null);
      return;
    }
    setConfirmingId(articleId);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
  }, [confirmingId, onDeleteArticle]);

  return (
    <aside className="sidebar">
      <button
        className="sidebar-home"
        onClick={onHome}
        title={t("common.home")}
      >
        {t("common.home")}
      </button>
      <h3 className="sidebar-title">{t("sidebar.title")}</h3>
      {error && <p className="sidebar-error">{error}</p>}
      {!error && history.length === 0 && (
        <p className="sidebar-empty">
          {t("sidebar.empty1")}
          <br />
          {t("sidebar.empty2")}
        </p>
      )}
      <ul className="sidebar-list">
        {history.map((item) => {
          const percent =
            item.total_paragraphs > 0
              ? Math.min(
                  100,
                  Math.round(
                    ((item.current_paragraph_index + 1) /
                      item.total_paragraphs) *
                      100,
                  ),
                )
              : 0;
          return (
            <li key={item.article_id} className="sidebar-li">
              <button
                className="sidebar-item"
                onClick={() =>
                  onOpenArticle({
                    article_id: item.article_id,
                    title_he: item.title_he,
                    title: item.title,
                    url: "",
                    paragraph_count: item.total_paragraphs,
                  })
                }
                title={`${item.title_he} — ${item.title}`}
              >
                <span className="sidebar-item-he" lang="he" dir="rtl">
                  {item.title_he}
                </span>
                <span className="sidebar-item-pt">{item.title}</span>
                <span className="sidebar-item-progress">
                  {item.completed
                    ? t("sidebar.completed")
                    : t("sidebar.paragraphOf", {
                        current: item.current_paragraph_index + 1,
                        total: item.total_paragraphs,
                        percent,
                      })}
                </span>
              </button>
              <button
                className={`sidebar-delete ${
                  confirmingId === item.article_id ? "confirming" : ""
                }`}
                onClick={() => armDelete(item.article_id)}
                title={
                  confirmingId === item.article_id
                    ? t("sidebar.confirmDelete")
                    : t("sidebar.delete")
                }
              >
                {confirmingId === item.article_id
                  ? t("sidebar.confirm")
                  : "🗑"}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sidebar-lang">
        <label htmlFor="sidebar-lang-select">{t("sidebar.language")}</label>
        <select
          id="sidebar-lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
        >
          {languageOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.nativeName}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
