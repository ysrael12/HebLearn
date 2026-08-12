import { useState } from "react";
import SearchScreen from "./screens/SearchScreen";
import ReadingScreen from "./screens/ReadingScreen";
import FlashcardsScreen from "./screens/FlashcardsScreen";
import LanguageScreen from "./screens/LanguageScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import StatsScreen from "./screens/StatsScreen";
import SettingsModal from "./screens/SettingsModal";
import Sidebar from "./screens/Sidebar";
import { useI18n } from "./i18n";
import { deleteArticle } from "./api";
import type { ArticleDetail } from "./types";
import "./App.css";

type View =
  | { name: "welcome" }
  | { name: "search" }
  | { name: "stats" }
  | { name: "reading"; article: ArticleDetail }
  | { name: "flashcards"; article: ArticleDetail; paragraphIndex: number };

function App() {
  const { ready, firstRun, t } = useI18n();
  const [view, setView] = useState<View>({ name: "welcome" });
  const [sidebarKey, setSidebarKey] = useState(0);
  const [onboarded, setOnboarded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshSidebar = () => setSidebarKey((k) => k + 1);

  const openArticle = (article: ArticleDetail) => {
    setView({ name: "reading", article });
  };

  const backToSearch = () => {
    setView({ name: "search" });
    refreshSidebar();
  };

  const goWelcome = () => {
    setView({ name: "welcome" });
    refreshSidebar();
  };

  const goStats = () => {
    setView({ name: "stats" });
  };

  const practice = (paragraphIndex: number) => {
    if (view.name === "reading") {
      setView({ name: "flashcards", article: view.article, paragraphIndex });
    }
  };

  const backToReading = () => {
    if (view.name === "flashcards") {
      setView({ name: "reading", article: view.article });
    }
  };

  const handleDeleteArticle = (articleId: number) => {
    deleteArticle(articleId)
      .then(() => {
        setView((v) => {
          if (
            (v.name === "reading" || v.name === "flashcards") &&
            v.article.article_id === articleId
          ) {
            return { name: "search" };
          }
          return v;
        });
        refreshSidebar();
      })
      .catch(() => {
        // erro silencioso: a sidebar recarrega e mantém o item
        refreshSidebar();
      });
  };

  return (
    <div className="app-shell">
      {!ready ? (
        <main className="app-main">
          <div className="status-card">
            <div className="nikud-spinner">
              <span className="spinner" aria-hidden="true" />
            </div>
          </div>
        </main>
      ) : firstRun && !onboarded ? (
        <main className="app-main">
          <LanguageScreen onDone={() => setOnboarded(true)} />
        </main>
      ) : (
        <>
          <Sidebar
            key={sidebarKey}
            onOpenArticle={openArticle}
            onDeleteArticle={handleDeleteArticle}
            onHome={goWelcome}
          />
          <main className="app-main">
            {view.name === "welcome" && (
              <WelcomeScreen
                onStart={() => setView({ name: "search" })}
                onContinue={openArticle}
                onStats={goStats}
              />
            )}
            {view.name === "stats" && <StatsScreen onBack={goWelcome} />}
            {view.name === "reading" && (
              <ReadingScreen
                key={view.article.article_id}
                article={view.article}
                onBack={backToSearch}
                onProgress={refreshSidebar}
                onPractice={practice}
              />
            )}
            {view.name === "flashcards" && (
              <FlashcardsScreen
                article={view.article}
                paragraphIndex={view.paragraphIndex}
                onBack={backToReading}
              />
            )}
            {view.name === "search" && (
              <SearchScreen onOpenArticle={openArticle} />
            )}
          </main>
          <button
            className="settings-gear"
            onClick={() => setSettingsOpen(true)}
            title={t("settings.title")}
          >
            ⚙
          </button>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </>
      )}
    </div>
  );
}

export default App;
