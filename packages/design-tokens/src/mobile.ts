import { officialSitePalette as palette } from './official-site'
import type { ResolvedTheme } from './index'

/** Mobile semantic roles share the approved official-site palette. */
export function mobileExperienceVariables(theme: ResolvedTheme): Record<string, string> {
  const dark = theme !== 'light'
  const high = theme === 'high-contrast'
  const p = (light: keyof typeof palette, night: keyof typeof palette = light) => palette[dark ? night : light]
  return {
    '--yx-brand': p('--yx-palette-006', '--yx-palette-025'),
    '--yx-brand-strong': p('--yx-palette-041', '--yx-palette-033'),
    '--yx-brand-soft': p('--yx-palette-007', '--yx-palette-026'),
    '--yx-action': palette['--yx-palette-006'], '--yx-on-brand': palette['--yx-palette-150'],
    '--yx-text-primary': high ? palette['--yx-palette-150'] : p('--yx-palette-003', '--yx-palette-022'),
    '--yx-text-secondary': high ? palette['--yx-palette-151'] : p('--yx-palette-004', '--yx-palette-023'),
    '--yx-text-tertiary': p('--yx-palette-004', '--yx-palette-023'),
    '--yx-surface-page': high ? palette['--yx-palette-148'] : p('--yx-palette-001', '--yx-palette-020'),
    '--yx-surface-card': high ? palette['--yx-palette-149'] : p('--yx-palette-002', '--yx-palette-021'),
    '--yx-surface-soft': p('--yx-palette-008', '--yx-palette-027'),
    '--yx-border': high ? palette['--yx-palette-151'] : p('--yx-palette-005', '--yx-palette-024'),
    '--yx-border-subtle': p('--yx-palette-005', '--yx-palette-024'),
    '--yx-focus': p('--yx-palette-006', '--yx-palette-025'),
    '--yx-success': p('--yx-palette-010', '--yx-palette-029'),
    '--yx-success-strong': p('--yx-palette-010', '--yx-palette-029'),
    '--yx-success-soft': p('--yx-palette-009', '--yx-palette-028'),
    '--yx-success-border': p('--yx-palette-075', '--yx-palette-029'),
    '--yx-warning': p('--yx-palette-012', '--yx-palette-031'),
    '--yx-warning-strong': p('--yx-palette-012', '--yx-palette-031'),
    '--yx-warning-soft': p('--yx-palette-011', '--yx-palette-030'),
    '--yx-danger': dark ? '#ffb3be' : '#a52b46',
    '--yx-danger-soft': dark ? '#432632' : '#fbeef1',
    '--yx-hero': high ? palette['--yx-palette-149'] : `linear-gradient(125deg, ${palette['--yx-palette-015']}, ${palette['--yx-palette-016']} 65%, ${palette['--yx-palette-017']})`,
    '--yx-hero-ink': palette['--yx-palette-150'], '--yx-hero-muted': palette['--yx-palette-060'],
    '--yx-art-paper': palette['--yx-palette-058'], '--yx-art-line': palette['--yx-palette-066'],
    '--yx-shadow': high ? 'none' : `0 12px 36px -28px ${p('--yx-palette-018', '--yx-palette-037')}`,
    '--yx-radius-card': '24px', '--yx-radius-button': '14px',
    '--yx-font-serif': 'Georgia, "Times New Roman", serif',
    '--yx-motion-fast': '180ms', '--yx-motion-enter': '420ms',
    ...mobileR4Variables(theme),
    ...mobileDecorationVariables(theme),
    ...mobileProfileVariables(theme),
    ...mobileClosedSkinVariables(theme),
  }
}

/**
 * Decorative stops only. Light and dark use the requested hex; dark does not
 * invent a second palette. High contrast uses each stop's existing semantic
 * fallback so the gradient is not the information channel. Reduced motion is
 * a page motion flag, not a recolor. These stops do not mean a feature is open.
 * Closed-card consumers compose 128.66deg with stops at 7.4% and 81.5%.
 */
function mobileDecorationVariables(theme: ResolvedTheme): Record<string, string> {
  const high = theme === 'high-contrast'
  const stop = (hex: string, fallback: string) => (high ? fallback : hex)
  return {
    '--closed-art-offline-from': stop('#38BDF8', 'var(--v2-info)'),
    '--closed-art-offline-to': stop('#6366F1', 'var(--v2-brand)'),
    '--closed-art-writing-from': stop('#34D399', 'var(--v2-ok)'),
    '--closed-art-writing-to': stop('#38BDF8', 'var(--v2-info)'),
    '--closed-art-listening-from': stop('#38BDF8', 'var(--v2-info)'),
    '--closed-art-listening-to': stop('#818CF8', 'var(--v2-brand2)'),
    '--closed-art-speaking-from': stop('#F472B6', 'var(--v2-brand2)'),
    '--closed-art-speaking-to': stop('#A78BFA', 'var(--v2-brand)'),
    '--games-tile-sentence-from': stop('#A78BFA', 'var(--v2-brand2)'),
    '--games-tile-sentence-to': stop('#6D4AE0', 'var(--v2-brand)'),
    '--games-tile-match-from': stop('#F472B6', 'var(--v2-brand2)'),
    '--games-tile-match-to': stop('#FB7185', 'var(--v2-bad)'),
    '--games-tile-defense-from': stop('#34D399', 'var(--v2-ok)'),
    '--games-tile-defense-to': stop('#10B981', 'var(--v2-info)'),
    '--games-tile-puzzle-from': stop('#FBBF24', 'var(--v2-warn)'),
    '--games-tile-puzzle-to': stop('#F97316', 'var(--v2-bad)'),
    '--games-tile-grammar-from': stop('#38BDF8', 'var(--v2-info)'),
    '--games-tile-grammar-to': stop('#6366F1', 'var(--v2-brand)'),
    '--games-tile-meaning-from': stop('#FB923C', 'var(--v2-warn)'),
    '--games-tile-meaning-to': stop('#F472B6', 'var(--v2-brand2)'),
    '--games-result-from': stop('#FBBF24', 'var(--v2-warn)'),
    '--games-result-to': stop('#F97316', 'var(--v2-bad)'),
  }
}

/**
 * R4 frame tokens for the login (98:1182) and home (166:7348) samples.
 * Existing `--yx-*` roles stay on the official-site palette. High contrast
 * drops blur, gradient and shadow. These keys do not change Web or official exports.
 */
function mobileR4Variables(theme: ResolvedTheme): Record<string, string> {
  if (theme === 'high-contrast') {
    return {
      '--yx-r4-page-color': 'var(--yx-surface-page)',
      '--yx-r4-page-image': 'none',
      '--yx-r4-home-image': 'none',
      '--yx-r4-ink': 'var(--yx-text-primary)',
      '--yx-r4-muted': 'var(--yx-text-secondary)',
      '--yx-r4-brand': 'var(--yx-brand)',
      '--yx-r4-glass': 'var(--yx-surface-card)',
      '--yx-r4-glass-border': 'var(--yx-border)',
      '--yx-r4-field': 'var(--yx-surface-page)',
      '--yx-r4-field-border': 'var(--yx-border)',
      '--yx-r4-tip': 'var(--yx-surface-soft)',
      '--yx-r4-cta-color': 'var(--yx-brand)',
      '--yx-r4-cta-image': 'none',
      '--yx-r4-on-cta': 'var(--yx-on-brand)',
      '--yx-r4-shadow-card': 'none',
      '--yx-r4-shadow-cta': 'none',
      '--yx-r4-shadow-field': 'none',
      '--yx-r4-blur': '0px',
      '--yx-r4-icon': 'var(--yx-text-primary)',
      '--yx-r4-wordmark': 'var(--yx-text-primary)',
      '--yx-r4-mascot-border': 'var(--yx-border)',
      '--yx-r4-mascot-image': 'none',
      '--yx-r4-mascot-color': 'var(--yx-surface-card)',
    }
  }
  const dark = theme === 'dark'
  return {
    '--yx-r4-page-color': dark ? '#15151f' : '#fcfaff',
    '--yx-r4-page-image': dark
      ? 'linear-gradient(160deg, #1b1630 0%, #15151f 46%, #241826 100%)'
      : 'linear-gradient(112deg, #f0e5ff 10.7%, #fcfaff 42.9%, #fff0f7 82.1%)',
    '--yx-r4-home-image': dark
      ? 'linear-gradient(180deg, #221b38 0%, #171526 45%, #15151f 100%)'
      : 'linear-gradient(180deg, #ede6ff 0%, #f4eeff 45%, #fbf8ff 100%)',
    '--yx-r4-ink': dark ? '#f1eff9' : '#222337',
    '--yx-r4-muted': dark ? '#bab8cf' : '#606277',
    '--yx-r4-brand': dark ? '#bcabff' : '#5935b8',
    '--yx-r4-glass': dark ? 'rgba(32, 32, 45, 0.92)' : 'rgba(250, 247, 255, 0.74)',
    '--yx-r4-glass-border': dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.72)',
    '--yx-r4-field': dark ? 'rgba(21, 21, 31, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    '--yx-r4-field-border': dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.95)',
    '--yx-r4-tip': dark ? '#2a2440' : '#f6f2ff',
    '--yx-r4-cta-color': dark ? '#bcabff' : '#4f2dae',
    '--yx-r4-cta-image': dark ? 'none' : 'linear-gradient(172deg, #4f2dae 14.3%, #6a45c6 53.6%, #8a55cc 85.7%)',
    '--yx-r4-on-cta': dark ? '#211b35' : '#ffffff',
    '--yx-r4-shadow-card': dark ? 'none' : '0 6px 16px rgba(89, 53, 184, 0.08)',
    '--yx-r4-shadow-cta': dark ? 'none' : '0 5px 16px rgba(89, 53, 184, 0.2)',
    '--yx-r4-shadow-field': dark ? 'none' : '0 2px 8px -1px rgba(42, 22, 96, 0.07)',
    '--yx-r4-blur': dark ? '0px' : '10px',
    '--yx-r4-icon': dark ? '#f1eff9' : '#222337',
    '--yx-r4-wordmark': dark ? '#d5d0ea' : '#4f3382',
    '--yx-r4-mascot-border': dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.95)',
    '--yx-r4-mascot-image': dark ? 'none' : 'linear-gradient(135deg, #e6dcff 0%, #fbe3f3 71%)',
    '--yx-r4-mascot-color': dark ? '#2a2440' : '#f4eeff',
  }
}

/**
 * Profile decoration only (dsh-profile-batch-01). Light and dark use the
 * requested stops; high contrast drops gradient, blur and shadow. A page
 * uses these only when its stylesheet reads `--yx-profile-*`. Reduced motion
 * stays a page data-motion flag. These keys do not mean a feature is open.
 */
function mobileProfileVariables(theme: ResolvedTheme): Record<string, string> {
  if (theme === 'high-contrast') {
    return {
      '--yx-profile-page-image': 'none',
      '--yx-profile-glass': 'var(--yx-surface-card)',
      '--yx-profile-glass-border': 'var(--yx-border)',
      '--yx-profile-avatar-image': 'var(--yx-brand)',
      '--yx-profile-tile-neutral': '#FFFFFF',
      '--yx-profile-card-shadow': 'none',
      '--yx-profile-cta-shadow': 'none',
      '--yx-profile-danger-shadow': 'none',
      '--yx-profile-blur': '0px',
      '--yx-profile-scrim': '#000000',
      '--yx-profile-scrim-opacity': '0.65',
    }
  }
  const dark = theme === 'dark'
  return {
    '--yx-profile-page-image': dark
      ? 'linear-gradient(180deg, #1B152F 0%, #1F1933 47%, #121423 100%)'
      : 'linear-gradient(180deg, #EDE6FF 0%, #F4EEFF 45%, #FBF8FF 100%)',
    '--yx-profile-glass': dark ? 'rgba(43, 37, 67, 0.88)' : 'rgba(255, 255, 255, 0.62)',
    '--yx-profile-glass-border': dark ? 'rgba(143, 121, 192, 0.3)' : 'rgba(255, 255, 255, 0.9)',
    '--yx-profile-avatar-image': 'linear-gradient(128.6598deg, #A78BFA 7.4074%, #6D4AE0 81.4815%)',
    '--yx-profile-tile-neutral': '#ECEDF3',
    '--yx-profile-card-shadow': '0 6px 16px -2px rgba(42, 22, 96, 0.09)',
    '--yx-profile-cta-shadow': '0 5px 8px rgba(89, 54, 184, 0.19)',
    '--yx-profile-danger-shadow': '0 4px 6px rgba(153, 36, 46, 0.15)',
    '--yx-profile-blur': '10px',
    '--yx-profile-scrim': dark ? '#080314' : '#1A1435',
    '--yx-profile-scrim-opacity': dark ? '0.55' : '0.4',
  }
}

/**
 * Closed-page skin from the 11 batch-07 token requests, already resolved
 * for the active theme. Light and dark use those request strings. High
 * contrast is not in the request: card and border use the existing
 * high-contrast surface pair, the CTA is the existing solid brand, and
 * shadows drop. Reduced motion stays a page data-motion flag.
 */
function mobileClosedSkinVariables(theme: ResolvedTheme): Record<string, string> {
  const ctaBackground = 'linear-gradient(172.0107deg, rgb(79,45,174) 14.286%, rgb(106,69,198) 53.571%, rgb(138,85,204) 85.714%)'
  const ctaShadow = '0 5px 8px rgba(89,54,184,0.19), inset 0 1px 0 rgba(255,255,255,0.19)'
  if (theme === 'high-contrast') {
    return {
      '--closed-card-bg': 'var(--yx-surface-card)',
      '--closed-card-border': 'var(--yx-border)',
      '--closed-card-shadow': 'none',
      '--closed-cta-background': 'var(--yx-brand)',
      '--closed-cta-on': 'var(--yx-surface-card)',
      '--closed-cta-shadow': 'none',
    }
  }
  const dark = theme === 'dark'
  return {
    '--closed-card-bg': dark ? 'rgba(48,40,63,0.97)' : 'rgba(255,255,255,0.62)',
    '--closed-card-border': dark ? 'rgba(141,115,195,0.4)' : 'rgba(255,255,255,0.9)',
    '--closed-card-shadow': dark ? '0 7px 8.5px rgba(8,3,20,0.35)' : '0 6px 16px -2px rgba(42,22,96,0.09)',
    '--closed-cta-background': ctaBackground,
    '--closed-cta-on': '#F5F0FF',
    '--closed-cta-shadow': ctaShadow,
  }
}
