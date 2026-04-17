import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

  // Minimal UI: key input + chat transcript + prompt box.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spase AI</title>
    <style>
      body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .row { display: flex; gap: 8px; align-items: center; }
      input, textarea, button { font: inherit; }
      input, textarea { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px 8px; border-radius: 6px; }
      button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
      button:disabled { opacity: 0.6; cursor: default; }
      .danger { background: var(--vscode-inputValidation-errorBackground, #8b0000); }
      .ghost { background: transparent; border: 1px solid var(--vscode-panel-border); }
      .wrap { max-width: 980px; margin: 0 auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; height: calc(100vh - 24px); box-sizing: border-box; }
      .transcript { flex: 1; overflow: auto; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 10px; }
      .msg { margin: 10px 0; white-space: pre-wrap; line-height: 1.35; }
      .role { font-size: 11px; opacity: 0.75; margin-bottom: 4px; }
      .status { font-size: 12px; opacity: 0.8; }
      .controls { display: flex; flex-direction: column; gap: 8px; }
      .small { font-size: 12px; opacity: 0.85; }
      label { user-select: none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="controls">
        <div class="row">
          <input id="apiKey" type="password" placeholder="API key (saved in VS Code SecretStorage)" />
          <button id="saveKey">Save key</button>
          <button id="stop" class="danger" title="Stop streaming">Stop</button>
          <button id="clear" class="ghost" title="Clear chat history">Clear</button>
        </div>
        <div class="row">
          <label class="small"><input id="includeActiveFile" type="checkbox" checked /> include active file</label>
          <div class="status" id="status"></div>
        </div>
      </div>

      <div class="transcript" id="transcript"></div>

      <div class="row">
        <textarea id="prompt" rows="3" placeholder="Ask something… (Ctrl+Enter to send)"></textarea>
        <button id="send">Send</button>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      const apiKeyEl = document.getElementById('apiKey');
      const saveKeyEl = document.getElementById('saveKey');
      const includeActiveFileEl = document.getElementById('includeActiveFile');
      const transcriptEl = document.getElementById('transcript');
      const promptEl = document.getElementById('prompt');
      const sendEl = document.getElementById('send');
      const stopEl = document.getElementById('stop');
      const clearEl = document.getElementById('clear');
      const statusEl = document.getElementById('status');

      let assistantBuffer = '';
      let assistantMsgEl = null;

      function addMessage(role, text) {
        const msg = document.createElement('div');
        msg.className = 'msg';
        const roleEl = document.createElement('div');
        roleEl.className = 'role';
        roleEl.textContent = role;
        const bodyEl = document.createElement('div');
        bodyEl.textContent = text;
        msg.appendChild(roleEl);
        msg.appendChild(bodyEl);
        transcriptEl.appendChild(msg);
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
        return bodyEl;
      }

      function clearTranscript() {
        transcriptEl.innerHTML = '';
        assistantBuffer = '';
        assistantMsgEl = null;
      }

      function hydrate(transcript) {
        clearTranscript();
        for (const m of transcript || []) {
          if (!m || !m.role) continue;
          addMessage(m.role, m.content || '');
        }
      }

      function setBusy(busy) {
        sendEl.disabled = busy;
        saveKeyEl.disabled = busy;
        stopEl.disabled = !busy;
        clearEl.disabled = busy;
      }

      saveKeyEl.addEventListener('click', () => {
        const apiKey = apiKeyEl.value.trim();
        if (!apiKey) return;
        vscode.postMessage({ type: 'setApiKey', apiKey });
        apiKeyEl.value = '';
      });

      async function send() {
        const text = promptEl.value.trim();
        if (!text) return;
        addMessage('you', text);
        promptEl.value = '';
        assistantBuffer = '';
        assistantMsgEl = addMessage('assistant', '');
        setBusy(true);
        vscode.postMessage({ type: 'send', text, includeActiveFile: !!includeActiveFileEl.checked });
      }

      sendEl.addEventListener('click', send);
      stopEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
      });
      clearEl.addEventListener('click', () => {
        vscode.postMessage({ type: 'clear' });
      });
      promptEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          send();
        }
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;

        if (msg.type === 'status') {
          statusEl.textContent = msg.text;
        } else if (msg.type === 'hydrate') {
          hydrate(msg.transcript);
        } else if (msg.type === 'clearTranscript') {
          clearTranscript();
        } else if (msg.type === 'appendAssistantToken') {
          assistantBuffer += msg.text;
          if (assistantMsgEl) assistantMsgEl.textContent = assistantBuffer;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        } else if (msg.type === 'finalizeAssistantMessage') {
          setBusy(false);
        } else if (msg.type === 'error') {
          setBusy(false);
          statusEl.textContent = msg.text;
        }
      });

      vscode.postMessage({ type: 'ready' });
      setBusy(false);
    </script>
  </body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

