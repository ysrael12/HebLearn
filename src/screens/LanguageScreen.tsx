import { useState } from "react";
import { languageOptions, useI18n } from "../i18n";
import type { Language } from "../i18n";

interface Props {
  onDone: () => void;
}

// Spec 11 — Tela de Configuração Inicial: define o idioma da interface
// antes de acessar a aplicação (exibida apenas na primeira execução).
export default function LanguageScreen({ onDone }: Props) {
  const { lang, setLang, t } = useI18n();
  const [selected, setSelected] = useState<Language>(lang);
  const [saving, setSaving] = useState(false);

  const confirm = () => {
    setSaving(true);
    setLang(selected).then(onDone);
  };

  return (
    <section className="language-screen">
      <h1>{t("onboarding.title")}</h1>
      <p className="note">{t("onboarding.subtitle")}</p>

      <div className="language-options" role="radiogroup">
        {languageOptions.map((opt) => (
          <button
            key={opt.code}
            type="button"
            role="radio"
            aria-checked={selected === opt.code}
            className={`language-option ${
              selected === opt.code ? "selected" : ""
            }`}
            onClick={() => setSelected(opt.code)}
          >
            <span className="language-name">{opt.nativeName}</span>
            <span className="language-preview">{opt.preview}</span>
          </button>
        ))}
      </div>

      <button
        className="continue-button"
        onClick={confirm}
        disabled={saving}
      >
        {saving ? t("onboarding.saving") : t("onboarding.continue")}
      </button>
    </section>
  );
}
