/**
 * MB-007 tablet Home layout decisions.
 *
 * The phone Home (<= 390px) keeps its existing single-column presentation.
 * Tablets use the confirmed iPad references: a compact 86px rail in portrait
 * (251:215) and the 244px sidebar in landscape/dark landscape (251:2, 251:362).
 * These helpers stay pure so the layout and tab-bar lifecycle can be unit
 * tested without a browser.
 */
export type HomeTabletLayout = 'phone' | 'rail' | 'sidebar'

export const HOME_TABLET_MIN_WIDTH = 768
export const HOME_TABLET_SIDEBAR_MIN_WIDTH = 1024
export const HOME_RAIL_WIDTH = 86
export const HOME_SIDEBAR_WIDTH = 244
export const HOME_CONTENT_WIDTH = 884

/** Width-only breakpoint: 834x1194 is rail, 1194x834 is sidebar. */
export function homeTabletLayout(width: number): HomeTabletLayout {
  if (!Number.isFinite(width) || width < HOME_TABLET_MIN_WIDTH) return 'phone'
  return width >= HOME_TABLET_SIDEBAR_MIN_WIDTH ? 'sidebar' : 'rail'
}

/** The native bottom tab bar is replaced by the rail/sidebar on tablet Home only. */
export function homeTabletTabBarHidden(layout: HomeTabletLayout): boolean {
  return layout !== 'phone'
}

/**
 * Lifecycle decision for the scoped uni tab bar. A hidden tab bar must be
 * restored while the page is leaving or when the viewport becomes a phone.
 */
export function homeTabletTabBarAction(layout: HomeTabletLayout, pageVisible: boolean): 'hide' | 'show' {
  return pageVisible && homeTabletTabBarHidden(layout) ? 'hide' : 'show'
}

/** Confirmed reference ring sizes: 108 portrait, 112 landscape, phone stays 96. */
export function homeTabletRingSize(layout: HomeTabletLayout): number {
  if (layout === 'sidebar') return 112
  if (layout === 'rail') return 108
  return 96
}

/** Confirmed reference CTA sizes: 270x50 portrait, 224x52 landscape. */
export function homeTabletCtaSize(layout: HomeTabletLayout): { width: number; height: number } {
  if (layout === 'sidebar') return { width: 224, height: 52 }
  if (layout === 'rail') return { width: 270, height: 50 }
  return { width: 0, height: 0 }
}

/**
 * Minutes left to the server target. `null` means there is no confirmed,
 * positive target; callers must not render a fabricated 0-minute goal.
 */
export function homeTabletMinuteGap(completedMinutes: number, targetMinutes: number): number | null {
  if (!Number.isFinite(completedMinutes) || !Number.isFinite(targetMinutes) || targetMinutes <= 0) return null
  return Math.max(0, Math.ceil(targetMinutes - completedMinutes))
}
