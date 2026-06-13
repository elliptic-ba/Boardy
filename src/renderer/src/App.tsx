import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store'
import AuthGate from './components/auth/AuthGate'
import AppShell from './components/AppShell'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export default function App(): React.JSX.Element {
  const authState = useStore((s) => s.authState)
  const settings = useStore((s) => s.settings)
  const init = useStore((s) => s.init)
  const lock = useStore((s) => s.lock)
  const systemDark = useSystemDark()

  const resolvedTheme = useMemo(
    () => (settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme),
    [settings.theme, systemDark]
  )

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // idle auto-lock
  const lastActivity = useRef(Date.now())
  useEffect(() => {
    const bump = (): void => {
      lastActivity.current = Date.now()
    }
    window.addEventListener('mousemove', bump)
    window.addEventListener('keydown', bump)
    window.addEventListener('mousedown', bump)
    const timer = setInterval(() => {
      const { autoLockMinutes } = useStore.getState().settings
      if (
        autoLockMinutes > 0 &&
        useStore.getState().authState === 'unlocked' &&
        Date.now() - lastActivity.current > autoLockMinutes * 60_000
      ) {
        void lock()
      }
    }, 10_000)
    return () => {
      window.removeEventListener('mousemove', bump)
      window.removeEventListener('keydown', bump)
      window.removeEventListener('mousedown', bump)
      clearInterval(timer)
    }
  }, [lock])

  if (authState === 'loading') return <div className="auth-screen" />
  if (authState !== 'unlocked') return <AuthGate theme={resolvedTheme} />
  return <AppShell theme={resolvedTheme} />
}
