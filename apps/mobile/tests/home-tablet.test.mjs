import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function load(relativePath, modules = {}) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const tablet = load('src/domain/home-tablet.ts')
const palette = load('../../packages/design-tokens/src/official-site.ts')
const tokens = load('../../packages/design-tokens/src/mobile.ts', { './official-site': palette })
const page = fs.readFileSync(path.join(appRoot, 'src/pages/home/home.vue'), 'utf8')
const nav = fs.readFileSync(path.join(appRoot, 'src/pages/home/HomeTabletNav.vue'), 'utf8')

test('tablet layout is compact rail at 834 portrait and sidebar at 1194 landscape', () => {
  assert.equal(tablet.homeTabletLayout(320), 'phone')
  assert.equal(tablet.homeTabletLayout(390), 'phone')
  assert.equal(tablet.homeTabletLayout(767), 'phone')
  assert.equal(tablet.homeTabletLayout(768), 'rail')
  assert.equal(tablet.homeTabletLayout(834), 'rail')
  assert.equal(tablet.homeTabletLayout(1023), 'rail')
  assert.equal(tablet.homeTabletLayout(1024), 'sidebar')
  assert.equal(tablet.homeTabletLayout(1194), 'sidebar')
  assert.equal(tablet.homeTabletLayout(Number.NaN), 'phone')
})

test('tablet tab bar is hidden only while the visible Home is a tablet', () => {
  assert.equal(tablet.homeTabletTabBarHidden('phone'), false)
  assert.equal(tablet.homeTabletTabBarHidden('rail'), true)
  assert.equal(tablet.homeTabletTabBarHidden('sidebar'), true)
  assert.equal(tablet.homeTabletTabBarAction('phone', true), 'show')
  assert.equal(tablet.homeTabletTabBarAction('rail', true), 'hide')
  assert.equal(tablet.homeTabletTabBarAction('sidebar', true), 'hide')
  assert.equal(tablet.homeTabletTabBarAction('rail', false), 'show')
  assert.equal(tablet.homeTabletTabBarAction('sidebar', false), 'show')
})

test('tablet reference dimensions are fixed and phone keeps its existing ring', () => {
  assert.equal(tablet.homeTabletRingSize('phone'), 96)
  assert.equal(tablet.homeTabletRingSize('rail'), 108)
  assert.equal(tablet.homeTabletRingSize('sidebar'), 112)
  assert.deepEqual(tablet.homeTabletCtaSize('rail'), { width: 270, height: 50 })
  assert.deepEqual(tablet.homeTabletCtaSize('sidebar'), { width: 224, height: 52 })
})

test('tablet minute gap is derived from server minutes and never fakes a target', () => {
  assert.equal(tablet.homeTabletMinuteGap(7, 15), 8)
  assert.equal(tablet.homeTabletMinuteGap(15, 15), 0)
  assert.equal(tablet.homeTabletMinuteGap(20, 15), 0)
  assert.equal(tablet.homeTabletMinuteGap(7, 0), null)
  assert.equal(tablet.homeTabletMinuteGap(7, -1), null)
  assert.equal(tablet.homeTabletMinuteGap(Number.NaN, 15), null)
})

test('Home source uses scoped uni tab-bar lifecycle and real tablet routes', () => {
  assert.match(page, /hideTabBar\?\.\(\{ animation: false/)
  assert.match(page, /showTabBar\?\.\(\{ animation: false/)
  assert.match(page, /homeTabletTabBarAction\(/)
  assert.match(page, /restoreTabletTabBar\(\)/)
  assert.match(page, /syncTabletLayout\(\)/)
  assert.match(page, /window\.addEventListener\('resize', syncTabletLayout/)
  assert.match(page, /window\.addEventListener\('orientationchange', syncTabletLayout/)
  assert.match(page, /window\.removeEventListener\('resize', syncTabletLayout\)/)
  assert.match(page, /id="course-heading"[^>]*tabindex="-1"/)
  assert.match(page, /home-tablet-cta-arrow/)
  assert.match(nav, /\/pages\/b2-practice\/b2-practice/)
  assert.match(nav, /\/pages\/world\/world/)
  assert.match(nav, /\/pages\/learn\/learn/)
  assert.match(nav, /\/pages\/profile\/profile/)
  assert.match(nav, /aria-current/)
  assert.doesNotMatch(page, /12天|33%|40%/)
  assert.doesNotMatch(page, /homeDarkAssets\.flame|art\.flame|art\.arc/)
})

test('tablet CSS matches the confirmed 251:215 / 251:2 / 251:362 geometry', () => {
  assert.match(page, /grid-template-columns: 86px minmax\(0, 686px\)/)
  assert.match(page, /grid-template-columns: 244px minmax\(0, 884px\)/)
  assert.match(page, /height: 227px/)
  assert.match(page, /height: 134px/)
  assert.match(page, /height: 343px/)
  assert.match(page, /height: 266px/)
  assert.match(page, /height: 248px/)
  assert.match(page, /height: 398px/)
  assert.match(page, /top: 157px; width: 270px/)
  assert.match(page, /top: 174px; width: 224px/)
  assert.match(page, /width: 108px; height: 108px/)
  assert.match(page, /width: 112px; height: 112px/)
  assert.match(page, /background-color: var\(--home-tablet-page-bg\)/)
  assert.match(page, /background-image: var\(--home-tablet-page-image\)/)
  assert.match(page, /color: var\(--home-tablet-hero-ink\)/)
  assert.doesNotMatch(page, /url\(data:image/)
  assert.doesNotMatch(page, /background-image: url\([^)]*\.png/)
})

test('tablet semantic roles are shared tokens and the business CSS has no new tablet literals', () => {
  const lightRail = tokens.mobileHomeTabletVariables('light', 'rail')
  const lightSidebar = tokens.mobileHomeTabletVariables('light', 'sidebar')
  const darkSidebar = tokens.mobileHomeTabletVariables('dark', 'sidebar')
  const high = tokens.mobileHomeTabletVariables('high-contrast', 'sidebar')

  assert.equal(lightRail['--home-tablet-panel'], '#fff')
  assert.equal(lightRail['--home-tablet-page-image'], 'linear-gradient(90deg, #faf7ff, #f4effc)')
  assert.equal(lightRail['--home-tablet-hero-image'], 'linear-gradient(90deg, #5d35b6, #a26bdd)')
  assert.equal(lightRail['--home-tablet-hero-cta-ink'], '#6238bc')
  assert.equal(lightSidebar['--home-tablet-page-image'], 'linear-gradient(90deg, #faf7ff, #f3eefa)')
  assert.equal(lightSidebar['--home-tablet-hero-image'], 'linear-gradient(90deg, #5d35b6, #a26bdd)')
  assert.equal(lightSidebar['--home-tablet-hero-color'], '#5d35b6')
  assert.equal(lightSidebar['--home-tablet-hero-cta-ink'], '#5935b8')
  assert.equal(lightSidebar['--home-tablet-course-cta-bg'], '#f1eafb')
  assert.equal(lightSidebar['--home-tablet-course-cta-color'], '#6737c1')
  assert.equal(lightSidebar['--home-tablet-course-art-kicker'], '#7655bb')
  assert.equal(darkSidebar['--home-tablet-panel'], '#2e2743')
  assert.equal(darkSidebar['--home-tablet-panel-border'], 'rgba(107, 88, 138, .52)')
  assert.equal(darkSidebar['--home-tablet-page-image'], 'linear-gradient(90deg, #171527, #262039)')
  assert.equal(darkSidebar['--home-tablet-hero-image'], 'linear-gradient(90deg, #5c35b6, #9b62d7)')
  assert.equal(darkSidebar['--home-tablet-nav-bg'], '#241b43')
  assert.equal(darkSidebar['--home-tablet-task-completed'], '#d8f2e6')

  assert.equal(high['--home-tablet-panel'], 'var(--yx-surface-card)')
  assert.equal(high['--home-tablet-hero-color'], 'var(--yx-action)')
  assert.equal(high['--home-tablet-hero-muted'], '#f8edff')
  assert.equal(high['--home-tablet-hero-cta-bg'], 'var(--yx-surface-card)')
  assert.equal(high['--home-tablet-hero-cta-border'], '1px solid var(--yx-border)')
  assert.equal(high['--home-tablet-course-art-border'], '1px solid var(--yx-border)')
  assert.equal(high['--home-tablet-nav-icon-bg'], 'var(--yx-text-primary)')
  assert.equal(high['--home-tablet-hero-fx-display'], 'none')
  assert.equal(high['--home-tablet-course-spark-display'], 'none')

  assert.match(page, /mobileHomeTabletVariables\(/)
  assert.match(page, /:style="pageStyle"/)
  assert.doesNotMatch(page, /--home-tablet-panel:\s*#/)
  assert.doesNotMatch(page, /#5d35b6|#5c35b6|#2e2743|#171527|#f0e8ff|#6b49af|#d8f2e6|#4c3290/)
  assert.doesNotMatch(nav, /#[0-9a-f]{3,8}|rgba?\(/i)
})
