import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { MonacoEditor, type MonacoFileModel } from "./editor/MonacoEditor";
import { WorkspaceTree } from "./workspace/WorkspaceTree";
import { fileRead, fileWrite, workspaceOpen } from "./workspace/workspaceApi";
import { ChatPanel } from "./chat/ChatPanel";
import { createStreamChat } from "./llm/streamChat";
import { loadSettings, saveSettings } from "./settings/storage";
import { SettingsModal } from "./settings/SettingsModal";
import type { Settings } from "./settings/types";
import { DEFAULT_SETTINGS } from "./settings/types";
import { chatConversationGet, chatConversationSet } from "./persistence/backend";
import type { ChatMessage } from "./llm/types";

function App() {
  const [activeFile, setActiveFile] = useState<MonacoFileModel>({
    path: "inmemory:///main.ts",
    language: "typescript",
    value: `export function hello() {\n  return "Spase-IDE";\n}\n`
  });
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [selectionText, setSelectionText] = useState<string>("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [conversation, setConversation] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await loadSettings();
      if (!cancelled) setSettings(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await chatConversationGet();
        if (cancelled) return;
        if (!raw || !Array.isArray(raw)) {
          setConversation(null);
          return;
        }
        const ok: ChatMessage[] = [];
        for (const m of raw as any[]) {
          if (!m || typeof m !== "object") continue;
          const role = (m as any).role;
          const content = (m as any).content;
          if ((role === "system" || role === "user" || role === "assistant") && typeof content === "string") {
            ok.push({ role, content });
          }
        }
        setConversation(ok.length ? ok : null);
      } catch {
        setConversation(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = useMemo(() => {
    const parts = activeFile.path.split(/[\\/]/g);
    return parts[parts.length - 1] || activeFile.path;
  }, [activeFile.path]);

  return (
    <div className="ideRoot">
      <aside className="sidebar">
        <div className="sidebarHeader">Spase-IDE</div>
        <div className="sidebarSectionTitle">Workspace</div>
        <button
          className="btn"
          onClick={async () => {
            try {
              setStatus("Opening folder…");
              const root = await workspaceOpen();
              setWorkspaceRoot(root);
              setStatus(`Opened: ${root}`);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              setStatus(message);
            }
          }}
        >
          Open folder
        </button>
        {workspaceRoot ? (
          <WorkspaceTree
            onOpenFile={async (relPath) => {
              try {
                setStatus(`Opening ${relPath}…`);
                const contents = await fileRead(relPath);
                const ext = relPath.split(".").pop()?.toLowerCase();
                const language =
                  ext === "ts" || ext === "tsx"
                    ? "typescript"
                    : ext === "js" || ext === "jsx"
                      ? "javascript"
                      : ext === "json"
                        ? "json"
                        : ext === "md"
                          ? "markdown"
                          : "plaintext";
                setActiveFile({ path: relPath, language, value: contents });
                setStatus("");
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setStatus(message);
              }
            }}
            rootLabel={workspaceRoot}
          />
        ) : (
          <div className="sidebarHint">No workspace opened.</div>
        )}
        {!!status && <div className="sidebarStatus">{status}</div>}
      </aside>

      <section className="main">
        <div className="topbar">
          <div className="tab">{title}</div>
          <div className="topbarSpacer" />
          <button
            className="btn"
            onClick={async () => {
              if (!workspaceRoot) {
                setStatus("Open a workspace first.");
                return;
              }
              if (activeFile.path.startsWith("inmemory:///")) {
                setStatus("This file is not in workspace.");
                return;
              }
              try {
                setStatus(`Saving ${activeFile.path}…`);
                await fileWrite(activeFile.path, activeFile.value);
                setStatus("Saved.");
                setTimeout(() => setStatus(""), 800);
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setStatus(message);
              }
            }}
          >
            Save
          </button>
        </div>

        <div className="content">
          <div className="editorPane">
            <MonacoEditor
              model={activeFile}
              onChange={(nextValue) => setActiveFile((p) => ({ ...p, value: nextValue }))}
              onSelectionTextChange={(txt) => setSelectionText(txt)}
            />
          </div>

          <div className="chatPane">
            <div className="chatHeader">Chat</div>
            <ChatPanel
              streamChat={createStreamChat(settings)}
              onOpenSettings={() => setSettingsOpen(true)}
              activeFilePath={activeFile.path}
              activeFileLanguage={activeFile.language}
              activeFileContents={activeFile.value}
              selectedText={selectionText}
              initialConversation={conversation ?? undefined}
              onConversationChange={(next) => {
                setConversation(next);
                void chatConversationSet(next);
              }}
            />
          </div>
        </div>
      </section>

      {settingsOpen && (
        <SettingsModal
          value={settings}
          onChange={(next) => {
            setSettings(next);
            void saveSettings(next);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
