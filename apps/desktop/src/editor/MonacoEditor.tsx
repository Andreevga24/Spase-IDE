import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type * as MonacoEditorNs from "monaco-editor";

export type MonacoFileModel = {
  path: string;
  language: string;
  value: string;
};

type Props = {
  model: MonacoFileModel;
  onChange: (nextValue: string) => void;
  onSelectionTextChange?: (selectedText: string) => void;
};

function detectTheme(): "vs" | "vs-dark" {
  if (typeof window === "undefined") return "vs";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "vs-dark" : "vs";
}

export function MonacoEditor({ model, onChange, onSelectionTextChange }: Props) {
  const [theme, setTheme] = useState<"vs" | "vs-dark">(detectTheme());
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditorNs.editor.IStandaloneCodeEditor | null>(null);
  const selectionCbRef = useRef<Props["onSelectionTextChange"]>(onSelectionTextChange);

  useEffect(() => {
    selectionCbRef.current = onSelectionTextChange;
  }, [onSelectionTextChange]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => setTheme(mq.matches ? "vs-dark" : "vs");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: "on" as const,
      scrollBeyondLastLine: false,
      wordWrap: "on" as const,
      automaticLayout: true
    }),
    []
  );

  return (
    <Editor
      height="100%"
      theme={theme}
      path={model.path}
      defaultLanguage={model.language}
      language={model.language}
      value={model.value}
      options={options}
      onMount={(editor, monaco) => {
        monacoRef.current = monaco;
        editorRef.current = editor;
        const sub = editor.onDidChangeCursorSelection(() => {
          const cb = selectionCbRef.current;
          if (!cb) return;
          const sel = editor.getSelection();
          if (!sel) return;
          const model = editor.getModel();
          if (!model) return;
          const txt = model.getValueInRange(sel);
          cb(txt);
        });
        editor.onDidDispose(() => sub.dispose());
      }}
      onChange={(val) => onChange(val ?? "")}
    />
  );
}

