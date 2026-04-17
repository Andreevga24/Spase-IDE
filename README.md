# Spase-IDE

Самостоятельный прототип IDE: **Tauri (desktop)** + **Monaco Editor** + **AI‑чат** (OpenAI-compatible + Ollama).

## Структура репозитория

- `apps/desktop/`: **десктоп‑приложение** (Tauri v2 + React + TypeScript)
- `apps/vscode-extension/`: **прототип расширения VS Code** (чат + контекст активного файла + стриминг)
- `docs/`: заметки / документация

## Десктоп‑приложение (рекомендуется)

### Требования (Windows)

- Node.js + npm
- Rust toolchain (`rustup`)
- **MSVC build tools** (нужно для `link.exe`):
  - установи **Build Tools for Visual Studio 2022**
  - выбери **Desktop development with C++**

### Запуск (только фронтенд, без сборки Rust)

```powershell
cd D:\Spase-IDE\apps\desktop
npm install
npm run dev
```

Далее открой `http://localhost:1420/`.

### Запуск (desktop dev)

```powershell
cd D:\Spase-IDE\apps\desktop
npm install
npm run tauri dev
```

### Сборка (инсталлятор/бандл)

```powershell
cd D:\Spase-IDE\apps\desktop
npm run tauri build
```

Если видишь `link.exe not found`, значит не установлены MSVC C++ Build Tools.

## Расширение VS Code (опционально)

Смотри `apps/vscode-extension/README.md`.

