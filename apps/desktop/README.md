# Spase-IDE (Desktop)

Desktop app shell for **Spase-IDE**: **Tauri (v2)** + **React** + **TypeScript**.

## Prerequisites (Windows)

- Node.js + npm
- Rust toolchain (`rustup`)
- **MSVC build tools** (required for `link.exe`):
  - Install **“Build Tools for Visual Studio 2022”** and select **Desktop development with C++**
  - Ensure `link.exe` is available in your Developer Command Prompt / PATH

## Commands

- Install deps:

```powershell
npm install
```

- Run (desktop dev):

```powershell
npm run tauri dev
```

- Package/build installer (desktop):

```powershell
npm run tauri build
```

If you see `link.exe not found`, install **Build Tools for Visual Studio 2022** with **Desktop development with C++**.

- Build (frontend only):

```powershell
npm run build
```

## Recommended IDE setup

- VS Code + Tauri extension + rust-analyzer
