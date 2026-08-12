import { useEffect, useState } from "react";
import { getReadingHistory } from "../api";
import { useI18n } from "../i18n";
import type { ArticleDetail, ReadingHistoryItem } from "../types";

interface Props {
  onStart: () => void;
  onContinue: (article: ArticleDetail) => void;
  onStats: () => void;
}

// Spec 01 — Tela de Boas-Vindas com logotipo e os três acessos principais.
export default function WelcomeScreen({ onStart, onContinue, onStats }: Props) {
  const { t } = useI18n();
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReadingHistory()
      .then(setHistory)
      .catch(() => {
        // ER-01-07: falha ao consultar progresso não bloqueia a tela.
      })
      .finally(() => setLoading(false));
  }, []);

  // FR-01-02/03: "Continuar Leitura" habilitado se existe artigo não concluído.
  // get_reading_history ordena por last_read DESC — o primeiro item não
  // concluído é o mais recente (DR-01-01).
  const target = history.find(
    (item) => !item.completed || item.current_paragraph_index > 0,
  );

  const continueReading = () => {
    if (!target) return;
    onContinue({
      article_id: target.article_id,
      title_he: target.title_he,
      title: target.title,
      url: "",
      paragraph_count: target.total_paragraphs,
    });
  };

  return (
    <section className="welcome-screen">
      <div className="welcome-logo" aria-hidden="true">
        ע
      </div>
      <h1 className="welcome-title">Aprendiz de Hebraico</h1>
      <p className="welcome-subtitle">{t("welcome.subtitle")}</p>
      <div className="welcome-buttons">
        <button
          className="welcome-btn primary"
          onClick={onStart}
          title={t("welcome.start")}
        >
          {t("welcome.start")}
        </button>
        <button
          className="welcome-btn"
          onClick={continueReading}
          disabled={loading || !target}
          title={t("welcome.continue")}
        >
          {t("welcome.continue")}
        </button>
        <button
          className="welcome-btn"
          onClick={onStats}
          title={t("welcome.stats")}
        >
          {t("welcome.stats")}
        </button>
        {!loading && !target && (
          <p className="welcome-hint">{t("welcome.noProgress")}</p>
        )}
      </div>
    </section>
  );
}
