import { useCallback, useEffect, useState } from "react";
import { clearCache, getAppInfo, getCacheStats } from "../api";
import { languageOptions, useI18n } from "../i18n";
import { useSettings } from "../settings";
import type { AppInfo, CacheStats, Prefs } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Spec 08 — modal de Configurações (UI-08-01/02/03), persistência via app_config.
export default function SettingsModal({ open, onClose }: Props) {
  const { t, lang } = useI18n();
  const { prefs, updatePref } = useSettings();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    setStats(null);
    setStatsError(false);
    setConfirmClear(false);
    getCacheStats().then(setStats).catch(() => setStatsError(true));
    getAppInfo().then(setAppInfo).catch(() => {});
  }, [open]);

  const change = useCallback(
    async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
      const ok = await updatePref(key, value);
      setSaveError(!ok);
    },
    [updatePref],
  );

  if (!open) return null;

  const targetLang = languageOptions.find((o) => o.code === lang);
  const speedLabel = Number(prefs.tts_speed.toFixed(2)).toString();

  const doClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setClearing(true);
    clearCache()
      .then(setStats)
      .catch(() => setStatsError(true))
      .finally(() => {
        setClearing(false);
        setConfirmClear(false);
      });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t("settings.title")}</h2>
          <button
            className="settings-close"
            onClick={onClose}
            title={t("settings.close")}
          >
            ×
          </button>
        </div>

        <section className="settings-section">
          <h3>{t("settings.appearance")}</h3>
          <div className="settings-row">
            <span>{t("settings.fontSize")}</span>
            <select
              value={prefs.font_size}
              onChange={(e) =>
                change("font_size", e.target.value as Prefs["font_size"])
              }
            >
              <option value="small">{t("settings.fontSmall")}</option>
              <option value="medium">{t("settings.fontMedium")}</option>
              <option value="large">{t("settings.fontLarge")}</option>
            </select>
          </div>
          <div className="settings-row">
            <span>{t("settings.theme")}</span>
            <select
              value={prefs.theme}
              onChange={(e) =>
                change("theme", e.target.value as Prefs["theme"])
              }
            >
              <option value="light">{t("settings.themeLight")}</option>
              <option value="dark">{t("settings.themeDark")}</option>
              <option value="auto">{t("settings.themeAuto")}</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h3>{t("settings.audio")}</h3>
          <div className="settings-row">
            <span>{t("settings.ttsSpeed")}</span>
            <div className="settings-speed">
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.25}
                value={prefs.tts_speed}
                onChange={(e) => change("tts_speed", Number(e.target.value))}
              />
              <span>{speedLabel}×</span>
            </div>
          </div>
          <div className="settings-row">
            <span>{t("settings.ttsVoice")}</span>
            <select
              value={prefs.tts_voice}
              onChange={(e) => change("tts_voice", e.target.value)}
              disabled
            >
              <option value="default">{t("settings.voiceDefault")}</option>
            </select>
          </div>
          <p className="settings-note">{t("settings.voiceNote")}</p>
        </section>

        <section className="settings-section">
          <h3>{t("settings.translation")}</h3>
          <div className="settings-row">
            <span>{t("settings.targetLang")}</span>
            <span className="settings-note">{targetLang?.nativeName}</span>
          </div>
          <p className="settings-note">{t("settings.targetLangNote")}</p>
          <div className="settings-row">
            <span>{t("settings.autoTranslate")}</span>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={prefs.auto_translate}
                onChange={(e) => change("auto_translate", e.target.checked)}
              />
              <span className="settings-switch-track" aria-hidden="true" />
            </label>
          </div>
          <p className="settings-note">{t("settings.autoTranslateNote")}</p>
        </section>

        <section className="settings-section">
          <h3>{t("settings.study")}</h3>
          <div className="settings-row">
            <span>{t("settings.studyMode")}</span>
            <select
              value={prefs.study_mode}
              onChange={(e) =>
                change("study_mode", e.target.value as Prefs["study_mode"])
              }
            >
              <option value="full">{t("settings.studyFull")}</option>
              <option value="reading">{t("settings.studyReadingOnly")}</option>
            </select>
          </div>
          <div className="settings-row">
            <span>{t("settings.flashcardsPerParagraph")}</span>
            <select
              value={prefs.flashcards_per_paragraph}
              onChange={(e) =>
                change("flashcards_per_paragraph", Number(e.target.value))
              }
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h3>{t("settings.cache")}</h3>
          {statsError ? (
            <p className="settings-note">{t("settings.cacheFailed")}</p>
          ) : (
            <>
              <div className="settings-cache-row">
                <span>{t("settings.cacheNikud")}</span>
                <span>{stats ? formatBytes(stats.nikud_bytes) : "…"}</span>
              </div>
              <div className="settings-cache-row">
                <span>{t("settings.cacheAudio")}</span>
                <span>{stats ? formatBytes(stats.audio_bytes) : "…"}</span>
              </div>
              <div className="settings-cache-row">
                <span>{t("settings.cacheTranslations")}</span>
                <span>
                  {stats ? formatBytes(stats.translation_bytes) : "…"}
                </span>
              </div>
              <div className="settings-cache-row">
                <span>{t("settings.cacheImages")}</span>
                <span>{stats ? formatBytes(stats.image_bytes) : "…"}</span>
              </div>
              <div className="settings-cache-row settings-cache-total">
                <span>{t("settings.cacheTotal")}</span>
                <span>{stats ? formatBytes(stats.total_bytes) : "…"}</span>
              </div>
              <button
                className={`settings-clear-btn ${
                  confirmClear ? "confirming" : ""
                }`}
                onClick={doClear}
                disabled={clearing || !stats}
                title={
                  confirmClear
                    ? t("settings.clearCacheConfirm")
                    : t("settings.clearCache")
                }
              >
                {clearing
                  ? t("settings.clearingCache")
                  : confirmClear
                    ? t("settings.clearCacheConfirm")
                    : t("settings.clearCache")}
              </button>
            </>
          )}
        </section>

        <section className="settings-section settings-about">
          <h3>{t("settings.about")}</h3>
          <p>
            {t("settings.version")}: {appInfo?.version ?? "…"}
          </p>
          <p className="settings-note">{t("settings.licenses")}</p>
        </section>

        <footer
          className={`settings-footer ${
            saveError ? "save-error" : ""
          }`}
        >
          {saveError ? t("settings.saveFailed") : t("settings.saved")}
        </footer>
      </div>
    </div>
  );
}
