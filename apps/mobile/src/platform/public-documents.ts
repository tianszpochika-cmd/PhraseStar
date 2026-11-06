import { openExternalUrl } from './uni-runtime'

const LOCAL_PUBLIC_ORIGIN = 'http://127.0.0.1:18182'

export type PublicDocumentKind = 'terms' | 'privacy'

export interface PublicSiteEnv {
  readonly DEV?: boolean
  readonly VITE_PUBLIC_SITE_ORIGIN?: string
}

/** Vite development only. Production and native release builds are not development. */
export function isPublicSiteDevelopment(env: PublicSiteEnv | undefined = import.meta.env): boolean {
  return env?.DEV === true
}

function configuredOrigin(env: PublicSiteEnv | undefined): string {
  const configured = env?.VITE_PUBLIC_SITE_ORIGIN
  if (typeof configured !== 'string') return ''
  return configured.trim().replace(/\/$/, '')
}

/**
 * Development with no setting uses the local official site.
 * Production and native release with no setting stay unavailable.
 * A configured value is returned unchanged so invalid http or credentials fail closed at the URL check.
 */
export function publicSiteOrigin(env: PublicSiteEnv | undefined = import.meta.env): string | null {
  const configured = configuredOrigin(env)
  if (configured) return configured
  if (isPublicSiteDevelopment(env)) return LOCAL_PUBLIC_ORIGIN
  return null
}

function parsePublicOrigin(origin: string, env: PublicSiteEnv | undefined): URL {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error('公开站点来源无效。')
  }
  if (parsed.username || parsed.password) throw new Error('公开站点来源不能携带凭据。')
  const localDevelopment = isPublicSiteDevelopment(env) && parsed.origin === LOCAL_PUBLIC_ORIGIN && parsed.protocol === 'http:'
  if (parsed.protocol !== 'https:' && !localDevelopment) throw new Error('公开站点来源必须是显式 HTTPS。')
  return parsed
}

/** Terms and privacy URLs. Query, hash, username and password are removed. */
export function publicDocumentUrl(kind: PublicDocumentKind, env: PublicSiteEnv | undefined = import.meta.env): string {
  const origin = publicSiteOrigin(env)
  if (!origin) throw new Error('公开站点尚未配置。')
  const parsed = parsePublicOrigin(origin, env)
  parsed.username = ''
  parsed.password = ''
  parsed.pathname = kind === 'terms' ? '/terms' : '/privacy'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

export function openPublicDocument(kind: PublicDocumentKind, env: PublicSiteEnv | undefined = import.meta.env): void {
  openExternalUrl(publicDocumentUrl(kind, env), env)
}
