# Spase IDE AI (VS Code extension prototype)

First working slice of **Spase-IDE** as a VS Code extension: **chat + active-file context + streaming**.

## Run (dev)

1. Install deps (from this folder):

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

2. Build:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run compile
```

3. Open this folder in VS Code and run the extension:

- Press `F5` (Run Extension) to open an Extension Development Host.
- Run command **“Spase AI: Open Chat”**.
- Paste your API key in the webview and click **Save key** (stored in VS Code SecretStorage).

## Settings

- `spaseAi.apiBaseUrl` (default `https://api.openai.com/v1`)
- `spaseAi.model` (default `gpt-4.1-mini`)
- `spaseAi.includeActiveFileByDefault`

