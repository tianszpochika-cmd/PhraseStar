/** Pure, data-only mapping for the avatar page. Unknown facts stay unknown. */
import type { B4AvatarItem, B4Loadout, B4PerformanceLevel } from '../../domain/b4'

export interface AvatarProfileView {
  avatarId: string | null
  resourceVersion: string | null
  loadoutId: string | null
  renderMode: '3D' | '2D_FALLBACK'
}
export interface AvatarItemView {
  itemCode: string
  quality: string | null
  slot: string | null
  resourceVersion: string | null
  owned: boolean | null
}
export interface AvatarLoadoutView {
  loadoutId: string
  name: string
  equipped: boolean
  items: string[]
}
export interface AvatarResourcesView {
  resourceVersion: string | null
  manifestHash: string | null
  fallbackMode: '3D' | '2D_FALLBACK'
  performanceTiers: B4PerformanceLevel[]
  manifestAvailable: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function unwrap(value: unknown): unknown {
  return isRecord(value) && isRecord(value.data) ? value.data : value
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
function records(value: unknown): Record<string, unknown>[] {
  const source = unwrap(value)
  if (!isRecord(source) || !Array.isArray(source.items)) return []
  return source.items.filter(isRecord)
}

export function parseAvatarProfile(value: unknown): AvatarProfileView | null {
  const source = unwrap(value)
  const profile = isRecord(source) && isRecord(source.profile) ? source.profile : source
  if (!isRecord(profile)) return null
  return {
    avatarId: text(profile.avatarId),
    resourceVersion: text(profile.resourceVersion),
    loadoutId: text(profile.loadoutId),
    renderMode: profile.renderMode === '3D' ? '3D' : '2D_FALLBACK',
  }
}

export function parseAvatarItems(value: unknown): AvatarItemView[] {
  return records(value).flatMap((item) => {
    const itemCode = text(item.itemCode)
    if (!itemCode) return []
    return [{
      itemCode,
      quality: text(item.quality),
      slot: text(item.slot),
      resourceVersion: text(item.resourceVersion),
      owned: typeof item.owned === 'boolean' ? item.owned : null,
    }]
  })
}

export function parseAvatarLoadouts(value: unknown): AvatarLoadoutView[] {
  return records(value).flatMap((loadout) => {
    const loadoutId = text(loadout.loadoutId)
    if (!loadoutId) return []
    return [{
      loadoutId,
      name: text(loadout.name) ?? loadoutId,
      equipped: loadout.equipped === true,
      items: Array.isArray(loadout.items) ? loadout.items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    }]
  })
}

export function parseAvatarResources(value: unknown): AvatarResourcesView | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const resourceVersion = text(source.resourceVersion)
  const manifestHash = text(source.manifestHash)
  const tiers = Array.isArray(source.performanceTiers)
    ? source.performanceTiers.filter((tier): tier is B4PerformanceLevel => tier === 'Ultra' || tier === 'High' || tier === 'Medium' || tier === 'Performance')
    : []
  return {
    resourceVersion,
    manifestHash,
    fallbackMode: source.fallbackMode === '3D' ? '3D' : '2D_FALLBACK',
    performanceTiers: tiers,
    manifestAvailable: Boolean(resourceVersion && manifestHash),
  }
}

/** Explicit current only: profile.loadoutId, or exactly one equipped loadout. Never the first row. */
export function currentLoadoutId(profile: AvatarProfileView | null, loadouts: AvatarLoadoutView[]): string | null {
  if (profile?.loadoutId) return profile.loadoutId
  const equipped = loadouts.filter((loadout) => loadout.equipped)
  return equipped.length === 1 ? equipped[0].loadoutId : null
}

export function slotKey(slot: string | null): string {
  return ({ HEAD: 'slotHead', FACE: 'slotFace', BODY: 'slotBody', AURA: 'slotAura' } as Record<string, string>)[slot ?? ''] ?? 'slotUnknown'
}
export function qualityKey(quality: string | null): string {
  return ({ COMMON: 'qualityCommon', RARE: 'qualityRare', EPIC: 'qualityEpic', LEGENDARY: 'qualityLegendary' } as Record<string, string>)[quality ?? ''] ?? 'qualityUnknown'
}
export function ownedKey(owned: boolean | null): string {
  return owned === true ? 'ownedTag' : owned === false ? 'lockedTag' : 'unknownOwnership'
}
export function loadoutSlots(loadout: AvatarLoadoutView, items: AvatarItemView[]): Array<{ itemCode: string; slot: string | null }> {
  return loadout.items.map((itemCode) => ({ itemCode, slot: items.find((item) => item.itemCode === itemCode)?.slot ?? null }))
}

/** Local-only compatibility views used by existing tests/imports; no server writes. */
export function toDomainItem(item: AvatarItemView): B4AvatarItem {
  return { itemCode: item.itemCode, quality: item.quality ?? 'UNKNOWN', slot: item.slot ?? 'UNKNOWN', resourceVersion: item.resourceVersion ?? 'UNKNOWN', ...(item.owned === null ? {} : { owned: item.owned }) }
}
export function toDomainLoadout(loadout: AvatarLoadoutView): B4Loadout {
  return { loadoutId: loadout.loadoutId, name: loadout.name, equipped: loadout.equipped, items: loadout.items }
}
