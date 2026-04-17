import { invoke } from "@tauri-apps/api/core";

export type StoredAppSettings = {
  provider: string;
  openaiCompatApiBaseUrl: string;
  openaiCompatModel: string;
  ollamaApiBaseUrl: string;
  ollamaModel: string;
};

export async function appSettingsGet(): Promise<StoredAppSettings | null> {
  return await invoke<StoredAppSettings | null>("app_settings_get");
}

export async function appSettingsSet(settings: StoredAppSettings): Promise<void> {
  await invoke("app_settings_set", { settings });
}

export async function chatConversationGet(): Promise<unknown | null> {
  return await invoke<unknown | null>("chat_conversation_get");
}

export async function chatConversationSet(conversation: unknown): Promise<void> {
  await invoke("chat_conversation_set", { conversation });
}

export async function secretGet(key: string): Promise<string | null> {
  return await invoke<string | null>("secret_get", { key });
}

export async function secretSet(key: string, value: string): Promise<void> {
  await invoke("secret_set", { key, value });
}

