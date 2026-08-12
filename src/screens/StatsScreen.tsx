import { useI18n } from "../i18n";

interface Props {
  onBack: () => void;
}

// Spec 01 FR-01-06 — destino do botão "Estatísticas de Aprendizado".
// ponytail: placeholder até a Spec 09 (Estatísticas) ser implementada;
// quando isso acontecer, substitua o corpo por uma tela real.
export default function StatsScreen({ onBack }: Props) {
  const { t } = useI18n();
  return (
    <section className="stats-screen">
      <button className="back-button" onClick={onBack}>
        {t("stats.back")}
      </button>
      <h2 className="stats-title">{t("stats.title")}</h2>
      <div className="status-card">
        <p>{t("stats.comingSoon")}</p>
      </div>
    </section>
  );
}
