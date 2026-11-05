import type { UniSecureStorage } from './uni-runtime'

export type SecureStorageProvider = () => UniSecureStorage | undefined

let platformProvider: SecureStorageProvider | undefined

/**
 * Registers the App-only native provider in module state.
 *
 * This deliberately does not read or write the vendor `globalThis.uni` object,
 * so App bootstrap works when that object is frozen, has a read-only
 * capability, or is temporarily absent. The first registration wins; later
 * bootstrap calls are no-ops.
 */
export function registerSecureStorageProvider(provider: SecureStorageProvider): void {
  if (!platformProvider) platformProvider = provider
}

/**
 * Resolves the existing injected `uni.getSecureStorage` provider first so a
 * host/test injection is never replaced. The host method keeps the vendor
 * runtime as its receiver. Its result wins even when undefined, and an
 * invocation error stays fail-closed instead of selecting the platform
 * provider. A missing vendor runtime or method falls back to the
 * platform-owned registration; returning undefined when neither exists keeps
 * callers fail-closed.
 */
export function resolveSecureStorage(): UniSecureStorage | undefined {
  let injected: SecureStorageProvider | undefined
  let receiver: unknown
  try {
    const holder = globalThis as typeof globalThis & { uni?: { getSecureStorage?: unknown } }
    const runtime = holder.uni
    const candidate = runtime?.getSecureStorage
    if (typeof candidate === 'function') {
      injected = candidate as SecureStorageProvider
      receiver = runtime
    }
  } catch {
    injected = undefined
  }
  if (injected) return injected.call(receiver)
  return platformProvider ? platformProvider() : undefined
}
