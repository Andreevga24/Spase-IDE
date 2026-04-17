import { invoke } from "@tauri-apps/api/core";

export type WorkspaceEntry = {
  name: string;
  relPath: string;
  isDir: boolean;
};

export async function workspaceOpen(): Promise<string> {
  return await invoke<string>("workspace_open");
}

export async function workspaceList(relDir?: string): Promise<WorkspaceEntry[]> {
  return await invoke<WorkspaceEntry[]>("workspace_list", { relDir });
}

export async function fileRead(relPath: string): Promise<string> {
  return await invoke<string>("file_read", { relPath });
}

export async function fileWrite(relPath: string, contents: string): Promise<void> {
  await invoke("file_write", { relPath, contents });
}

