import * as vscode from "vscode";
import { ChatPanel } from "./chat/ChatPanel";

export function activate(context: vscode.ExtensionContext) {
  const openChat = vscode.commands.registerCommand("spaseAi.openChat", () => {
    ChatPanel.createOrShow(context);
  });

  const clearChat = vscode.commands.registerCommand("spaseAi.clearChat", async () => {
    await ChatPanel.clearPersistedHistory(context);
    ChatPanel.currentPanel?.refreshFromPersistedHistory();
  });

  context.subscriptions.push(openChat, clearChat);
}

export function deactivate() {
  // no-op
}

