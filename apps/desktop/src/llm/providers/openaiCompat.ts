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

export async function streamOpenAICompat(args: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (t: string) => void;
}): Promise<void> {
  const url = normalizeBaseUrl(args.apiBaseUrl) + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`
    },
    signal: args.signal,
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    const text = await safeReadText(res);
    throw new Error(`LLM request failed (${res.status}): ${text || res.statusText}`);
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
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);

      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (!payload) continue;
      if (payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        const token: string | undefined = json?.choices?.[0]?.delta?.content;
        if (token) args.onToken(token);
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export const openaiCompatProvider: (cfg: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}) => (a: StreamChatArgs) => Promise<void> =
  (cfg) =>
  async (a) => {
    if (!cfg.apiKey.trim()) throw new Error("OpenAI-compatible: API key is empty.");
    await streamOpenAICompat({
      apiBaseUrl: cfg.apiBaseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      messages: a.messages,
      signal: a.signal,
      onToken: a.onToken
    });
  };

