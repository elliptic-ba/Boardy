import { useState } from 'react'
import { useStore } from '../../store'
import boardyIcon from '../../assets/boardy-icon-color.svg'

type Screen = 'login' | 'setup' | 'recovery-key' | 'recover'

function passwordStrength(pw: string): { pct: number; color: string; label: string } {
  let score = 0
  if (pw.length >= 10) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const levels = [
    { pct: 10, color: '#eb5757', label: 'Too short' },
    { pct: 25, color: '#eb5757', label: 'Weak' },
    { pct: 50, color: '#e9a13b', label: 'Okay' },
    { pct: 70, color: '#e9a13b', label: 'Good' },
    { pct: 90, color: '#4dab9a', label: 'Strong' },
    { pct: 100, color: '#4dab9a', label: 'Very strong' }
  ]
  return levels[score]
}

export default function AuthGate({ theme }: { theme: 'light' | 'dark' }): React.JSX.Element {
  void theme
  const authState = useStore((s) => s.authState)
  const setAuthState = useStore((s) => s.setAuthState)
  const [screen, setScreen] = useState<Screen>(authState === 'uninitialized' ? 'setup' : 'login')

  // setup state
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  // recover state
  const [recoverKeyInput, setRecoverKeyInput] = useState('')

  const strength = passwordStrength(password)

  const doSetup = async (): Promise<void> => {
    setError('')
    if (password.length < 10) {
      setError('Password must be at least 10 characters.')
      return
    }
    // deepcode ignore TimingAttack: both operands are typed by the same local user in this form; no secret is involved (real verification is constant-time GCM/timingSafeEqual in the main process)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { recoveryKey: rk } = await window.boardy.auth.setup(password)
      setRecoveryKey(rk)
      setScreen('recovery-key')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed.')
    } finally {
      setBusy(false)
    }
  }

  const doUnlock = async (): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      const res = await window.boardy.auth.unlock(password)
      if (!res.ok) {
        setError(res.error ?? 'Incorrect password.')
        return
      }
      setAuthState('unlocked')
    } finally {
      setBusy(false)
    }
  }

  const doRecover = async (): Promise<void> => {
    setError('')
    if (password.length < 10) {
      setError('New password must be at least 10 characters.')
      return
    }
    // deepcode ignore TimingAttack: both operands are typed by the same local user in this form; no secret is involved
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await window.boardy.auth.recover(recoverKeyInput, password)
      if (!res.ok) {
        setError(res.error ?? 'Invalid recovery key.')
        return
      }
      setAuthState('unlocked')
    } finally {
      setBusy(false)
    }
  }

  const finishSetup = (): void => {
    setAuthState('unlocked')
  }

  const copyKey = async (): Promise<void> => {
    await navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onEnter =
    (fn: () => void) =>
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') fn()
    }

  if (screen === 'setup') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <img className="auth-logo-img" src={boardyIcon} alt="Boardy" width={64} height={64} />
          <h1 className="auth-title">Welcome to Boardy</h1>
          <p className="auth-sub">
            Create a master password to protect your workspace. Everything you write is encrypted
            with it and stored only on this computer.
          </p>
          <div className="auth-field">
            <label>Master password</label>
            <input
              className="text-input"
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter(() => void doSetup())}
              placeholder="At least 10 characters"
            />
            {password.length > 0 && (
              <div className="password-strength">
                <div style={{ width: `${strength.pct}%`, background: strength.color }} />
              </div>
            )}
          </div>
          <div className="auth-field">
            <label>Confirm password</label>
            <input
              className="text-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={onEnter(() => void doSetup())}
              placeholder="Repeat your password"
            />
          </div>
          <div className="auth-error">{error}</div>
          <button className="btn primary" disabled={busy} onClick={() => void doSetup()}>
            {busy ? 'Setting up…' : 'Create workspace'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'recovery-key') {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ width: 440 }}>
          <div className="auth-logo">🔑</div>
          <h1 className="auth-title">Save your recovery key</h1>
          <p className="auth-sub">
            If you ever forget your master password, this key is the <b>only</b> way to get your
            data back. Store it somewhere safe — it will not be shown again.
          </p>
          <div className="recovery-key-box">{recoveryKey}</div>
          <button className="btn" style={{ justifyContent: 'center' }} onClick={() => void copyKey()}>
            {copied ? '✓ Copied' : 'Copy to clipboard'}
          </button>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
            />
            <span>I have saved my recovery key somewhere safe. I understand that without it, a
            forgotten password means my data is lost forever.</span>
          </label>
          <button className="btn primary" disabled={!savedConfirmed} onClick={finishSetup}>
            Open my workspace
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'recover') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🛟</div>
          <h1 className="auth-title">Recover your workspace</h1>
          <p className="auth-sub">
            Enter the recovery key you saved during setup, then choose a new master password.
          </p>
          <div className="auth-field">
            <label>Recovery key</label>
            <input
              className="text-input"
              value={recoverKeyInput}
              autoFocus
              onChange={(e) => setRecoverKeyInput(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-…"
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>New master password</label>
            <input
              className="text-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label>Confirm new password</label>
            <input
              className="text-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={onEnter(() => void doRecover())}
            />
          </div>
          <div className="auth-error">{error}</div>
          <button className="btn primary" disabled={busy} onClick={() => void doRecover()}>
            {busy ? 'Recovering…' : 'Reset password & unlock'}
          </button>
          <div className="auth-footer">
            <button
              onClick={() => {
                setScreen('login')
                setError('')
                setPassword('')
                setConfirm('')
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo-img" src={boardyIcon} alt="Boardy" width={64} height={64} />
        <h1 className="auth-title">Boardy is locked</h1>
        <p className="auth-sub">Enter your master password to unlock your workspace.</p>
        <div className="auth-field">
          <label>Master password</label>
          <input
            className="text-input"
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnter(() => void doUnlock())}
          />
        </div>
        <div className="auth-error">{error}</div>
        <button className="btn primary" disabled={busy || !password} onClick={() => void doUnlock()}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
        <div className="auth-footer">
          <button
            onClick={() => {
              setScreen('recover')
              setError('')
              setPassword('')
              setConfirm('')
            }}
          >
            Forgot password? Use recovery key
          </button>
        </div>
      </div>
    </div>
  )
}
