import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'

/** Non-sensitive preferences live outside the encrypted DB so the lock screen
 *  can already respect the chosen theme. */

const DEFAULTS: AppSettings = { theme: 'system', autoLockMinutes: 0 }

function configPath(dataDir: string): string {
  return join(dataDir, 'config.json')
}

export function getSettings(dataDir: string): AppSettings {
  try {
    if (existsSync(configPath(dataDir))) {
      return { ...DEFAULTS, ...(JSON.parse(readFileSync(configPath(dataDir), 'utf8')) as Partial<AppSettings>) }
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULTS }
}

export function setSettings(dataDir: string, patch: Partial<AppSettings>): AppSettings {
  const merged = { ...getSettings(dataDir), ...patch }
  writeFileSync(configPath(dataDir), JSON.stringify(merged, null, 2))
  return merged
}
