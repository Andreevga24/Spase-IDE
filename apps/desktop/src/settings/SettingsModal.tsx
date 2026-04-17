import type { Settings } from "./types";

type Props = {
  value: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
};

export function SettingsModal({ value, onChange, onClose }: Props) {
  return (
    <div className="modalBackdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modalHeader">
          <div className="modalTitle">Settings</div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modalBody">
          <label className="field">
            <div className="fieldLabel">Provider</div>
            <select
              className="input"
              value={value.provider}
              onChange={(e) =>
                onChange({ ...value, provider: e.currentTarget.value as Settings["provider"] })
              }
            >
              <option value="openaiCompat">OpenAI-compatible</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </label>

          {value.provider === "openaiCompat" && (
            <div className="card">
              <div className="cardTitle">OpenAI-compatible</div>
              <label className="field">
                <div className="fieldLabel">API base URL</div>
                <input
                  className="input"
                  value={value.openaiCompat.apiBaseUrl}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      openaiCompat: { ...value.openaiCompat, apiBaseUrl: e.currentTarget.value }
                    })
                  }
                />
              </label>
              <label className="field">
                <div className="fieldLabel">Model</div>
                <input
                  className="input"
                  value={value.openaiCompat.model}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      openaiCompat: { ...value.openaiCompat, model: e.currentTarget.value }
                    })
                  }
                />
              </label>
              <label className="field">
                <div className="fieldLabel">API key</div>
                <input
                  className="input"
                  type="password"
                  value={value.openaiCompat.apiKey}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      openaiCompat: { ...value.openaiCompat, apiKey: e.currentTarget.value }
                    })
                  }
                />
                <div className="fieldHint">
                  В desktop-режиме ключ сохраняется через системный keychain/credential store (keyring). В браузерном preview — в localStorage.
                </div>
              </label>
            </div>
          )}

          {value.provider === "ollama" && (
            <div className="card">
              <div className="cardTitle">Ollama</div>
              <label className="field">
                <div className="fieldLabel">API base URL</div>
                <input
                  className="input"
                  value={value.ollama.apiBaseUrl}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      ollama: { ...value.ollama, apiBaseUrl: e.currentTarget.value }
                    })
                  }
                />
              </label>
              <label className="field">
                <div className="fieldLabel">Model</div>
                <input
                  className="input"
                  value={value.ollama.model}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      ollama: { ...value.ollama, model: e.currentTarget.value }
                    })
                  }
                />
              </label>
              <div className="fieldHint">Ожидается запущенный Ollama на указанном URL.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

