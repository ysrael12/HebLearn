import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getPrefs, setPref } from "./api";
import type { Prefs } from "./types";

// Spec 08 — padrões das preferências (espelham os defaults do backend).
export const DEFAULT_PREFS: Prefs = {
  font_size: "medium",
  theme: "auto",
  tts_speed: 0.75,
  tts_voice: "default",
  auto_translate: true,
  study_mode: "full",
  flashcards_per_paragraph: 5,
};

interface SettingsValue {
  prefs: Prefs;
  ready: boolean;
  updatePref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getPrefs()
      .then(setPrefs)
      .catch(() => {
        // ER-08-01: sem persistência lida, usa os padrões.
      })
      .finally(() => setReady(true));
  }, []);

  // FR-08-02/13: tema aplicado em tempo real; "auto" volta ao media query.
  useEffect(() => {
    const el = document.documentElement;
    if (prefs.theme === "auto") delete el.dataset.theme;
    else el.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  // FR-08-01/13: tamanho da fonte do texto hebraico.
  useEffect(() => {
    document.documentElement.dataset.font = prefs.font_size;
  }, [prefs.font_size]);

  const updatePref = useCallback(
    async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
      const prev = prefs[key];
      setPrefs((p) => ({ ...p, [key]: value }));
      try {
        await setPref(key, value);
        return true;
      } catch {
        // ER-08-01: falha ao persistir → mantém os valores anteriores.
        setPrefs((p) => ({ ...p, [key]: prev }));
        return false;
      }
    },
    [prefs],
  );

  const value = useMemo<SettingsValue>(
    () => ({ prefs, ready, updatePref }),
    [prefs, ready, updatePref],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings deve ser usado dentro de SettingsProvider");
  return ctx;
}
