import * as vscode from "vscode";
import { getWebviewHtml } from "./getWebviewHtml";
import { streamChatCompletion, type ChatMessage } from "../ai/openaiCompatible";

const SECRET_KEY = "spaseAi.apiKey";

type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "setApiKey"; apiKey: string }
  | { type: "send"; text: string; includeActiveFile: boolean }
  | { type: "clear" }
  | { type: "cancel" };

type ExtensionToWebviewMessage =
  | { type: "status"; text: string }
  | { type: "hydrate"; transcript: Array<{ role: "you" | "assistant"; content: string }> }
  | { type: "clearTranscript" }
  | { type: "appendAssistantToken"; text: string }
  | { type: "finalizeAssistantMessage" }
  | { type: "error"; text: string };

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private static readonly HISTORY_KEY = "spaseAi.chatHistory.v1";

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private conversation: ChatMessage[] = [];
  private activeRequestAbort: AbortController | undefined;

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "spaseAiChat",
      "Spase AI",
      column ?? vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, context);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.context = context;

    this.panel.onDidDispose(() => {
      ChatPanel.currentPanel = undefined;
    });

    this.panel.webview.html = getWebviewHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
      switch (msg.type) {
        case "ready":
          this.conversation = this.loadPersistedConversation();
          this.post({ type: "hydrate", transcript: this.toTranscript(this.conversation) });
          this.post({ type: "status", text: "Ready. Set API key to start." });
          return;
        case "setApiKey":
          await this.context.secrets.store(SECRET_KEY, msg.apiKey);
          this.post({ type: "status", text: "API key saved (SecretStorage)." });
          return;
        case "send":
          await this.handleSend(msg.text, msg.includeActiveFile);
          return;
        case "clear":
          await ChatPanel.clearPersistedHistory(this.context);
          this.conversation = [];
          this.post({ type: "clearTranscript" });
          this.post({ type: "status", text: "Cleared." });
          return;
        case "cancel":
          this.activeRequestAbort?.abort();
          this.activeRequestAbort = undefined;
          this.post({ type: "finalizeAssistantMessage" });
          this.post({ type: "status", text: "Stopped." });
          return;
      }
    });
  }

  private post(message: ExtensionToWebviewMessage) {
    void this.panel.webview.postMessage(message);
  }

  public refreshFromPersistedHistory() {
    this.conversation = this.loadPersistedConversation();
    this.post({ type: "hydrate", transcript: this.toTranscript(this.conversation) });
    this.post({ type: "status", text: "History refreshed." });
  }

  public static async clearPersistedHistory(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(ChatPanel.HISTORY_KEY, undefined);
  }

  private loadPersistedConversation(): ChatMessage[] {
    const raw = this.context.globalState.get<unknown>(ChatPanel.HISTORY_KEY);
    if (!Array.isArray(raw)) return [];

    const ok: ChatMessage[] = [];
    for (const m of raw) {
      if (
        m &&
        typeof m === "object" &&
        "role" in m &&
        "content" in m &&
        (m as { role?: unknown }).role &&
        (m as { content?: unknown }).content
      ) {
        const role = (m as { role: unknown }).role;
        const content = (m as { content: unknown }).content;
        if (
          (role === "system" || role === "user" || role === "assistant") &&
          typeof content === "string"
        ) {
          ok.push({ role, content } as ChatMessage);
        }
      }
    }
    return ok;
  }

  private async persistConversation(): Promise<void> {
    await this.context.globalState.update(ChatPanel.HISTORY_KEY, this.conversation);
  }

  private toTranscript(conversation: ChatMessage[]): Array<{ role: "you" | "assistant"; content: string }> {
    const out: Array<{ role: "you" | "assistant"; content: string }> = [];
    for (const m of conversation) {
      if (m.role === "user") out.push({ role: "you", content: m.content });
      if (m.role === "assistant") out.push({ role: "assistant", content: m.content });
    }
    return out;
  }

  private async handleSend(text: string, includeActiveFile: boolean) {
    const apiKey = await this.context.secrets.get(SECRET_KEY);
    if (!apiKey) {
      this.post({ type: "error", text: "No API key set. Use the key field at the top." });
      return;
    }

    const cfg = vscode.workspace.getConfiguration("spaseAi");
    const apiBaseUrl = cfg.get<string>("apiBaseUrl") ?? "https://api.openai.com/v1";
    const model = cfg.get<string>("model") ?? "gpt-4.1-mini";

    let activeFileContext = "";
    if (includeActiveFile) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const doc = editor.document;
        const selection = editor.selection;
        const selected = selection.isEmpty ? "" : doc.getText(selection);
        const fullText = doc.getText();

        activeFileContext =
          `Active file: ${doc.fileName}\n` +
          `Language: ${doc.languageId}\n\n` +
          (selected
            ? `Selected text:\n${selected}\n\n`
            : "No selection.\n\n") +
          `File contents:\n${fullText}\n`;
      }
    }

    const system =
      "You are a coding assistant inside a VS Code extension. " +
      "Be concise, propose safe changes, and if you suggest edits, prefer unified diffs.";

    const user = activeFileContext ? `${text}\n\n---\n\n${activeFileContext}` : text;

    this.post({ type: "status", text: `Requesting ${model}…` });

    try {
      if (this.conversation.length === 0) {
        this.conversation = [{ role: "system", content: system }];
      }

      this.conversation.push({ role: "user", content: user });
      await this.persistConversation();

      const abort = new AbortController();
      this.activeRequestAbort = abort;

      let assistantText = "";
      await streamChatCompletion({
        apiBaseUrl,
        apiKey,
        model,
        messages: this.conversation,
        signal: abort.signal,
        onToken: (t) => {
          assistantText += t;
          this.post({ type: "appendAssistantToken", text: t });
        }
      });
      this.conversation.push({ role: "assistant", content: assistantText });
      await this.persistConversation();
      this.post({ type: "finalizeAssistantMessage" });
      this.post({ type: "status", text: "Done." });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        this.post({ type: "status", text: "Stopped." });
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      this.post({ type: "error", text: message });
    } finally {
      this.activeRequestAbort = undefined;
    }
  }
}

