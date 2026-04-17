export type LlmProviderId = "openaiCompat" | "ollama";

export type Settings = {
  provider: LlmProviderId;
  openaiCompat: {
    apiBaseUrl: string;
    model: string;
    apiKey: string;
  };
  ollama: {
    apiBaseUrl: string;
    model: string;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "openaiCompat",
  openaiCompat: {
    apiBaseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKey: ""
  },
  ollama: {
    apiBaseUrl: "http://localhost:11434",
    model: "llama3.1"
  }
};

