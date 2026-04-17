type Role = "system" | "user" | "assistant";

export type ChatMessage = {
  role: Role;
  content: string;
};

export type StreamChatArgs = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  onToken: (token: string) => void;
  signal?: AbortSignal;
};

/**
 * Streams tokens from an OpenAI-compatible `/chat/completions` endpoint using SSE.
 * Works with OpenAI-style streaming responses where lines contain `data: ...`.
 */
export async function streamChatCompletion(args: StreamChatArgs): Promise<void> {
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

