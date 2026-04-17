import type { Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { appSettingsGet, appSettingsSet, secretGet, secretSet } from "../persistence/backend";

const LOCAL_KEY = "spase.settings.v1";
const SECRET_KEY_OPENAI = "openaiCompat.apiKey";

function canUseTauriInvoke(): boolean {
  return typeof window !== "undefined" && typeof (window as any).__TAURI__ !== "undefined";
}

function loadSettingsFromLocal(): Settings {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      openaiCompat: { ...DEFAULT_SETTINGS.openaiCompat, ...(parsed.openaiCompat ?? {}) },
      ollama: { ...DEFAULT_SETTINGS.ollama, ...(parsed.ollama ?? {}) }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsToLocal(s: Settings) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
}

export async function loadSettings(): Promise<Settings> {
  const local = loadSettingsFromLocal();
  if (!canUseTauriInvoke()) return local;

  try {
    const stored = await appSettingsGet();
    const apiKey = (await secretGet(SECRET_KEY_OPENAI)) ?? "";
    if (!stored) return { ...local, openaiCompat: { ...local.openaiCompat, apiKey } };

    const next: Settings = {
      provider: stored.provider === "ollama" ? "ollama" : "openaiCompat",
      openaiCompat: {
        apiBaseUrl: stored.openaiCompatApiBaseUrl || DEFAULT_SETTINGS.openaiCompat.apiBaseUrl,
        model: stored.openaiCompatModel || DEFAULT_SETTINGS.openaiCompat.model,
        apiKey
      },
      ollama: {
        apiBaseUrl: stored.ollamaApiBaseUrl || DEFAULT_SETTINGS.ollama.apiBaseUrl,
        model: stored.ollamaModel || DEFAULT_SETTINGS.ollama.model
      }
    };
    saveSettingsToLocal(next);
    return next;
  } catch {
    return local;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  saveSettingsToLocal(s);
  if (!canUseTauriInvoke()) return;

  await appSettingsSet({
    provider: s.provider,
    openaiCompatApiBaseUrl: s.openaiCompat.apiBaseUrl,
    openaiCompatModel: s.openaiCompat.model,
    ollamaApiBaseUrl: s.ollama.apiBaseUrl,
    ollamaModel: s.ollama.model
  });

  if (s.openaiCompat.apiKey.trim()) {
    await secretSet(SECRET_KEY_OPENAI, s.openaiCompat.apiKey);
  }
}

