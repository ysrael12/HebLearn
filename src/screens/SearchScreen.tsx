import { useEffect, useRef, useState } from "react";
import type { ArticleDetail, ArticlePreview } from "../types";
import { wikiAutocomplete, wikiOpenArticle, wikiSearch } from "../api";
import { useI18n } from "../i18n";

interface Props {
  onOpenArticle: (article: ArticleDetail) => void;
}

export default function SearchScreen({ onOpenArticle }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<ArticlePreview[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [autocompleting, setAutocompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    setAutocompleting(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const titles = await wikiAutocomplete(term, lang);
        setSuggestions(titles);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setAutocompleting(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [lang, query]);

  async function handleSearch(term?: string) {
    const trimmed = (term ?? query).trim();
    if (!trimmed) return;
    setSearching(true);
    setError(null);
    setResults(null);
    setShowSuggestions(false);
    try {
      const found = await wikiSearch(trimmed, lang);
      setResults(found);
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function handleOpen(title: string) {
    setError(null);
    setOpening(title);
    try {
      const article = await wikiOpenArticle(title, lang);
      onOpenArticle(article);
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(null);
    }
  }

  function selectSuggestion(title: string) {
    setQuery(title);
    setShowSuggestions(false);
    handleSearch(title);
  }

  return (
    <section className="search-screen">
      <h1>{t("search.title")}</h1>
      <p className="note">{t("search.note")}</p>

      <div className="search-bar">
        <input
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.aria")}
        />
        <button onClick={() => handleSearch()} disabled={searching}>
          {searching ? t("search.searching") : t("search.button")}
        </button>
      </div>

      {autocompleting && <p className="hint">{t("search.suggestions")}</p>}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={() => selectSuggestion(s)}
              role="option"
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      {searching && <p className="hint">{t("search.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {results !== null && results.length === 0 && !searching && (
        <p className="hint">{t("search.empty")}</p>
      )}

      {results && results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.title}>
              <button
                className="result-item"
                onClick={() => handleOpen(r.title)}
                disabled={opening !== null}
              >
                <span className="result-title">{r.title}</span>
                {r.summary && (
                  <span className="result-summary">{r.summary}</span>
                )}
                {opening === r.title && (
                  <span className="hint">{t("search.downloading")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
