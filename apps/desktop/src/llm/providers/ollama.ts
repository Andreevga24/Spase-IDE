import type { ChatMessage, StreamChatArgs } from "../types";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function streamOllama(args: {
  apiBaseUrl: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (t: string) => void;
}): Promise<void> {
  const url = normalizeBaseUrl(args.apiBaseUrl) + "/api/chat";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify({
      model: args.model,
      stream: true,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content }))
    })
  });

  if (!res.ok || !res.body) {
    const text = await safeReadText(res);
    throw new Error(`Ollama request failed (${res.status}): ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        const token: string | undefined = json?.message?.content;
        if (token) args.onToken(token);
        if (json?.done) return;
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export const ollamaProvider: (cfg: { apiBaseUrl: string; model: string }) => (a: StreamChatArgs) => Promise<void> =
  (cfg) =>
  async (a) => {
    await streamOllama({
      apiBaseUrl: cfg.apiBaseUrl,
      model: cfg.model,
      messages: a.messages,
      signal: a.signal,
      onToken: a.onToken
    });
  };

