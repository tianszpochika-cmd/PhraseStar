import { readSecureItem, removeSecureItem, writeSecureItem } from '../uni_modules/yx-secure-storage'
import { registerSecureStorageProvider } from './secure-storage-provider'
import type { UniSecureStorage } from './uni-runtime'

const REFRESH_TOKEN_KEY = 'yx.auth.mobile.refresh-token'
const MAX_ENVELOPE_LENGTH = 32 * 1024

interface SecureStorageEnvelope {
  ok: boolean
  value: string | null
  code: string
  osStatus: number
  message: string
}

export class NativeSecureStorageError extends Error {
  readonly code: string
  readonly osStatus: number

  constructor(code: string, osStatus: number, message: string) {
    super(message || 'Native secure storage failed.')
    this.name = 'NativeSecureStorageError'
    this.code = code
    this.osStatus = osStatus
  }
}

function parseEnvelope(raw: unknown): SecureStorageEnvelope {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_ENVELOPE_LENGTH) {
    throw new NativeSecureStorageError('invalid_envelope', 0, 'Native secure storage returned an invalid envelope.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new NativeSecureStorageError('invalid_envelope', 0, 'Native secure storage returned malformed JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new NativeSecureStorageError('invalid_envelope', 0, 'Native secure storage returned a non-object envelope.')
  }
  const candidate = parsed as Partial<SecureStorageEnvelope>
  if (typeof candidate.ok !== 'boolean'
    || (candidate.value !== null && typeof candidate.value !== 'string')
    || typeof candidate.code !== 'string'
    || typeof candidate.osStatus !== 'number'
    || !Number.isInteger(candidate.osStatus)
    || typeof candidate.message !== 'string') {
    throw new NativeSecureStorageError('invalid_envelope', 0, 'Native secure storage envelope is incomplete.')
  }
  return {
    ok: candidate.ok,
    value: candidate.value ?? null,
    code: candidate.code,
    osStatus: candidate.osStatus,
    message: candidate.message,
  }
}

function invoke(action: () => string): string | null {
  let raw: string
  try {
    raw = action()
  } catch {
    throw new NativeSecureStorageError('native_call_failed', 0, 'Native secure storage call failed.')
  }
  const envelope = parseEnvelope(raw)
  if (!envelope.ok) throw new NativeSecureStorageError(envelope.code, envelope.osStatus, envelope.message)
  return envelope.value
}

/**
 * Maps the single native key to the existing UniSecureStorage boundary.
 * The native side independently rejects every other key.
 */
export function createNativeSecureStorage(): UniSecureStorage {
  return {
    getItem(key: string): string | null {
      if (key !== REFRESH_TOKEN_KEY) {
        throw new NativeSecureStorageError('invalid_key', 0, 'Unsupported secure-storage key.')
      }
      return invoke(() => readSecureItem(key))
    },
    setItem(key: string, value: string): void {
      if (key !== REFRESH_TOKEN_KEY) {
        throw new NativeSecureStorageError('invalid_key', 0, 'Unsupported secure-storage key.')
      }
      invoke(() => writeSecureItem(key, value))
    },
    removeItem(key: string): void {
      if (key !== REFRESH_TOKEN_KEY) {
        throw new NativeSecureStorageError('invalid_key', 0, 'Unsupported secure-storage key.')
      }
      invoke(() => removeSecureItem(key))
    },
  }
}

/**
 * Registers the native provider in platform module state.
 *
 * App bootstrap must not depend on the vendor `globalThis.uni` object being
 * writable (or present at all). The session boundary consults this module,
 * prefers any injected `uni.getSecureStorage`, and stays fail-closed when no
 * provider exists.
 */
export function installNativeSecureStorage(): void {
  const storage = createNativeSecureStorage()
  registerSecureStorageProvider(() => storage)
}
