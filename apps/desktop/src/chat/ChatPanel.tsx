import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, StreamChatFn } from "../llm/types";

type TranscriptItem = { role: "you" | "assistant"; content: string };

type Props = {
  streamChat: StreamChatFn;
  onOpenSettings: () => void;
  activeFilePath: string;
  activeFileLanguage: string;
  activeFileContents: string;
  selectedText: string;
  initialConversation?: ChatMessage[];
  onConversationChange?: (nextConversation: ChatMessage[]) => void;
};

function buildUserPrompt(args: {
  text: string;
  activeFilePath: string;
  activeFileLanguage: string;
  activeFileContents: string;
  selectedText: string;
}): string {
  const hasSelection = args.selectedText.trim().length > 0;
  const fileContext =
    `Active file: ${args.activeFilePath}\n` +
    `Language: ${args.activeFileLanguage}\n\n` +
    (hasSelection ? `Selected text:\n${args.selectedText}\n\n` : "No selection.\n\n") +
    `File contents:\n${args.activeFileContents}\n`;

  return `${args.text}\n\n---\n\n${fileContext}`;
}

export function ChatPanel(props: Props) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [input, setInput] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef<boolean>(false);

  const system = useMemo(
    () =>
      "You are a coding assistant inside Spase-IDE. " +
      "Be concise, propose safe changes, and if you suggest edits, prefer unified diffs.",
    []
  );

  const conversationRef = useRef<ChatMessage[]>([{ role: "system", content: system }]);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!props.initialConversation || props.initialConversation.length === 0) return;
    conversationRef.current = props.initialConversation;
    const transcript: TranscriptItem[] = [];
    for (const m of props.initialConversation) {
      if (m.role === "user") transcript.push({ role: "you", content: m.content });
      if (m.role === "assistant") transcript.push({ role: "assistant", content: m.content });
    }
    setItems(transcript);
    hydratedRef.current = true;
  }, [props.initialConversation]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStatus("Stopped.");
  };

  const clear = () => {
    stop();
    setItems([]);
    conversationRef.current = [{ role: "system", content: system }];
    setStatus("Cleared.");
    props.onConversationChange?.(conversationRef.current);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setStatus("");
    setBusy(true);

    setItems((p) => [...p, { role: "you", content: text }, { role: "assistant", content: "" }]);

    const user = buildUserPrompt({
      text,
      activeFilePath: props.activeFilePath,
      activeFileLanguage: props.activeFileLanguage,
      activeFileContents: props.activeFileContents,
      selectedText: props.selectedText
    });

    conversationRef.current = [...conversationRef.current, { role: "user", content: user }];
    props.onConversationChange?.(conversationRef.current);
    const abort = new AbortController();
    abortRef.current = abort;

    let assistantText = "";

    try {
      setStatus("Thinking…");
      await props.streamChat({
        messages: conversationRef.current,
        signal: abort.signal,
        onToken: (t) => {
          assistantText += t;
          setItems((prev) => {
            if (prev.length === 0) return prev;
            const next = prev.slice();
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return prev;
            next[next.length - 1] = { role: "assistant", content: assistantText };
            return next;
          });
        }
      });
      conversationRef.current = [...conversationRef.current, { role: "assistant", content: assistantText }];
      props.onConversationChange?.(conversationRef.current);
      setStatus("Done.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const message = e instanceof Error ? e.message : String(e);
      setStatus(message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="chat">
      <div className="chatToolbar">
        <button className="btn" disabled={!busy} onClick={stop} title="Stop streaming">
          Stop
        </button>
        <button className="btn" disabled={busy} onClick={clear} title="Clear chat">
          Clear
        </button>
        <button className="btn" disabled={busy} onClick={props.onOpenSettings} title="Open settings">
          Settings
        </button>
        <div className="chatStatus">{status}</div>
      </div>

      <div className="chatTranscript">
        {items.map((m, idx) => (
          <div key={idx} className="chatMsg">
            <div className="chatRole">{m.role}</div>
            <div className="chatContent">{m.content}</div>
          </div>
        ))}
      </div>

      <div className="chatComposer">
        <textarea
          className="chatInput"
          rows={3}
          value={input}
          placeholder="Ask something… (Ctrl+Enter to send)"
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn" disabled={busy} onClick={() => void send()}>
          Send
        </button>
      </div>
    </div>
  );
}

