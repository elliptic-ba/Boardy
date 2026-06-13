import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ThemePref } from '@shared/types'
import { useStore } from '../store'
import { Select } from './ui/Select'

export default function SettingsModal(): React.JSX.Element {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const changePassword = async (): Promise<void> => {
    setPwMsg(null)
    if (next.length < 10) {
      setPwMsg({ ok: false, text: 'New password must be at least 10 characters.' })
      return
    }
    // deepcode ignore TimingAttack: both operands are typed by the same local user in this form; no secret is involved
    if (next !== confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    setBusy(true)
    try {
      const res = await window.boardy.auth.changePassword(current, next)
      if (res.ok) {
        setPwMsg({ ok: true, text: 'Password changed. Your recovery key still works.' })
        setCurrent('')
        setNext('')
        setConfirm('')
      } else {
        setPwMsg({ ok: false, text: res.error ?? 'Could not change password.' })
      }
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
      <div className="modal" style={{ width: 520 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="settings-body">
          <div className="settings-section">
            <h3>Appearance</h3>
            <div className="settings-row">
              <div>
                <div className="settings-label">Theme</div>
                <div className="settings-desc">How Boardy looks on this device</div>
              </div>
              <Select<ThemePref>
                value={settings.theme}
                onChange={(theme) => void updateSettings({ theme })}
                options={[
                  { value: 'system', label: 'Use system setting' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' }
                ]}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>Security</h3>
            <div className="settings-row">
              <div>
                <div className="settings-label">Auto-lock</div>
                <div className="settings-desc">Lock the workspace after inactivity</div>
              </div>
              <Select<number>
                value={settings.autoLockMinutes}
                onChange={(autoLockMinutes) => void updateSettings({ autoLockMinutes })}
                options={[
                  { value: 0, label: 'Never' },
                  { value: 5, label: 'After 5 minutes' },
                  { value: 10, label: 'After 10 minutes' },
                  { value: 30, label: 'After 30 minutes' },
                  { value: 60, label: 'After 1 hour' }
                ]}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="settings-label" style={{ marginBottom: 8 }}>
                Change master password
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="text-input"
                  type="password"
                  placeholder="Current password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
                <input
                  className="text-input"
                  type="password"
                  placeholder="New password (min. 10 characters)"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <input
                  className="text-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {pwMsg && (
                  <div
                    style={{
                      fontSize: 13,
                      color: pwMsg.ok ? 'var(--accent-text)' : 'var(--danger)'
                    }}
                  >
                    {pwMsg.text}
                  </div>
                )}
                <button
                  className="btn primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={busy || !current || !next}
                  onClick={() => void changePassword()}
                >
                  {busy ? 'Changing…' : 'Change password'}
                </button>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <div className="settings-desc">
              Boardy a local, encrypted workspace. All data is stored on this computer,
              encrypted with a key derived from your master password. Nothing ever leaves your
              machine.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
