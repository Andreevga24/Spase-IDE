import type { StreamChatFn } from "./types";
import type { Settings } from "../settings/types";
import { openaiCompatProvider } from "./providers/openaiCompat";
import { ollamaProvider } from "./providers/ollama";

export function createStreamChat(settings: Settings): StreamChatFn {
  if (settings.provider === "openaiCompat") {
    return openaiCompatProvider({
      apiBaseUrl: settings.openaiCompat.apiBaseUrl,
      apiKey: settings.openaiCompat.apiKey,
      model: settings.openaiCompat.model
    });
  }

  return ollamaProvider({
    apiBaseUrl: settings.ollama.apiBaseUrl,
    model: settings.ollama.model
  });
}
