import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

/**
 * Keystore: a random 256-bit master encryption key (MEK) encrypts the SQLite
 * database. The MEK is wrapped twice with AES-256-GCM — once with a key
 * derived from the master password, once with a key derived from the recovery
 * key. Unwrapping authenticates (GCM), so a wrong password fails cleanly.
 */

// N=2^17 per current OWASP guidance. Each keystore stores the params it was
// written with (see `wrapped.kdf` in unwrap), so raising N only affects newly
// created/re-wrapped keys — existing keystores still unlock with their old N.
const SCRYPT_PARAMS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
const KEY_LEN = 32

interface WrappedKey {
  salt: string
  iv: string
  tag: string
  data: string
  kdf: { N: number; r: number; p: number }
}

interface KeystoreFile {
  version: 1
  password: WrappedKey
  recovery: WrappedKey
  createdAt: number
}

// Crockford Base32 (no I, L, O, U) for the human-readable recovery key.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function keystorePath(dataDir: string): string {
  return join(dataDir, 'keystore.json')
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN, SCRYPT_PARAMS)
}

function wrap(mek: Buffer, secret: string): WrappedKey {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(secret, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(mek), cipher.final()])
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
    kdf: { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p }
  }
}

function unwrap(wrapped: WrappedKey, secret: string): Buffer | null {
  try {
    const salt = Buffer.from(wrapped.salt, 'base64')
    const key = scryptSync(secret, salt, KEY_LEN, { ...wrapped.kdf, maxmem: SCRYPT_PARAMS.maxmem })
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(wrapped.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(wrapped.data, 'base64')), decipher.final()])
  } catch {
    return null
  }
}

function generateRecoveryKey(): string {
  // 8 groups of 5 chars = 200 bits of entropy
  const bytes = randomBytes(25)
  let bits = 0
  let acc = 0
  let out = ''
  for (const b of bytes) {
    acc = (acc << 8) | b
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += CROCKFORD[(acc >> bits) & 31]
    }
  }
  return out.slice(0, 40).replace(/(.{5})(?=.)/g, '$1-')
}

export function normalizeRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')
    .replace(/(.{5})(?=.)/g, '$1-')
}

export function keystoreExists(dataDir: string): boolean {
  return existsSync(keystorePath(dataDir))
}

function readKeystore(dataDir: string): KeystoreFile {
  return JSON.parse(readFileSync(keystorePath(dataDir), 'utf8')) as KeystoreFile
}

function writeKeystore(dataDir: string, ks: KeystoreFile): void {
  // write-then-rename so a crash can't truncate the only copy of the wrapped MEK
  const tmp = keystorePath(dataDir) + '.tmp'
  writeFileSync(tmp, JSON.stringify(ks, null, 2), { mode: 0o600 })
  renameSync(tmp, keystorePath(dataDir))
}

/** First run: create keystore. Returns the MEK and the one-time recovery key. */
export function createKeystore(
  dataDir: string,
  password: string
): { mek: Buffer; recoveryKey: string } {
  const mek = randomBytes(KEY_LEN)
  const recoveryKey = generateRecoveryKey()
  const ks: KeystoreFile = {
    version: 1,
    password: wrap(mek, password),
    recovery: wrap(mek, recoveryKey),
    createdAt: Date.now()
  }
  writeKeystore(dataDir, ks)
  return { mek, recoveryKey }
}

export function unlockWithPassword(dataDir: string, password: string): Buffer | null {
  return unwrap(readKeystore(dataDir).password, password)
}

export function unlockWithRecoveryKey(dataDir: string, recoveryKey: string): Buffer | null {
  return unwrap(readKeystore(dataDir).recovery, normalizeRecoveryKey(recoveryKey))
}

/** Re-wrap the MEK under a new password (no database re-encryption needed). */
export function rewrapPassword(dataDir: string, mek: Buffer, newPassword: string): void {
  const ks = readKeystore(dataDir)
  ks.password = wrap(mek, newPassword)
  writeKeystore(dataDir, ks)
}

export function verifyPassword(dataDir: string, mek: Buffer, password: string): boolean {
  const got = unwrap(readKeystore(dataDir).password, password)
  return got !== null && got.length === mek.length && timingSafeEqual(got, mek)
}
