import { useEffect, useState } from "react";
import type { WorkspaceEntry } from "./workspaceApi";
import { workspaceList } from "./workspaceApi";

type Props = {
  onOpenFile: (relPath: string) => void;
  rootLabel?: string;
};

type DirState =
  | { kind: "loading" }
  | { kind: "loaded"; entries: WorkspaceEntry[] }
  | { kind: "error"; message: string };

function basename(relPath: string): string {
  const p = relPath.replace(/\\/g, "/");
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

export function WorkspaceTree({ onOpenFile, rootLabel = "Workspace" }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "": true });
  const [dirData, setDirData] = useState<Record<string, DirState>>({});

  const ensureLoaded = async (relDir: string) => {
    if (dirData[relDir]?.kind === "loaded" || dirData[relDir]?.kind === "loading") return;
    setDirData((p) => ({ ...p, [relDir]: { kind: "loading" } }));
    try {
      const entries = await workspaceList(relDir || undefined);
      setDirData((p) => ({ ...p, [relDir]: { kind: "loaded", entries } }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setDirData((p) => ({ ...p, [relDir]: { kind: "error", message } }));
    }
  };

  useEffect(() => {
    void ensureLoaded("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDir = (relDir: string, depth: number) => {
    const data = dirData[relDir];
    const isExpanded = !!expanded[relDir];

    const header =
      relDir === ""
        ? { name: rootLabel, relPath: "", isDir: true }
        : { name: basename(relDir), relPath: relDir, isDir: true };

    return (
      <div key={relDir}>
        <div
          className="treeRow"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => {
            setExpanded((p) => ({ ...p, [relDir]: !isExpanded }));
            if (!isExpanded) void ensureLoaded(relDir);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="treeIcon">{isExpanded ? "▼" : "▶"}</span>
          <span className="treeName">{header.name}</span>
        </div>

        {isExpanded && (
          <div>
            {data?.kind === "loading" && (
              <div className="treeRow treeMuted" style={{ paddingLeft: 28 + depth * 12 }}>
                loading…
              </div>
            )}
            {data?.kind === "error" && (
              <div className="treeRow treeError" style={{ paddingLeft: 28 + depth * 12 }}>
                {data.message}
              </div>
            )}
            {data?.kind === "loaded" &&
              data.entries.map((e) => {
                const isDir = e.isDir;
                if (isDir) return renderDir(e.relPath, depth + 1);
                return (
                  <div
                    key={e.relPath}
                    className="treeRow"
                    style={{ paddingLeft: 28 + depth * 12 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpenFile(e.relPath);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="treeIcon">•</span>
                    <span className="treeName">{e.name}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  return <div className="tree">{renderDir("", 0)}</div>;
}

