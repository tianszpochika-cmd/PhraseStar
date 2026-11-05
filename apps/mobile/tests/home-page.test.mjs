import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function load(relativePath, modules) {
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

const resume = load('src/domain/onboarding-resume.ts', {})
const home = load('src/domain/home-page.ts', { './onboarding-resume': resume })
const page = fs.readFileSync(path.join(appRoot, 'src/pages/home/home.vue'), 'utf8')
const assets = fs.readFileSync(path.join(appRoot, 'src/theme/figma-r4-assets.ts'), 'utf8')

function facts(target = { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 }) {
  return {
    adultGate: 'PASSED',
    adultLearningAccess: 'ELIGIBLE',
    consent: { readable: true, accepted: true, unsatisfiedPurposes: [] },
    target,
  }
}

test('home guide routes and remaining labels follow the resume domain', () => {
  const goal = facts({ readable: true, saved: false, goal: null, quota: null })
  assert.equal(home.homeGuideStep(goal), 'goal')
  assert.equal(home.homeGuideVisible(goal, false), true)
  assert.equal(home.homeGuidePath('goal'), '/pages/onboarding/onboarding')
  assert.equal(home.homeGuidePath('consent'), '/pages/onboarding/onboarding')
  assert.equal(home.homeGuidePath('assessment'), '/pages/assessment/assessment')
  assert.equal(home.homeGuidePath('rejected'), null)
  assert.equal(home.homeGuidePath(null), null)
  assert.deepEqual(home.homeGuideRemainingLabels(goal, false), ['学习目标'])
  assert.deepEqual(home.homeGuideRemainingLabels(facts(), false), ['定级'])
  assert.deepEqual(home.homeGuideRemainingLabels(facts(), true), [])
  assert.equal(home.homeGuideVisible(facts(), false, false), true)
  assert.equal(home.homeGuideVisible(facts(), true, false), false)
  assert.equal(home.homeGuideVisible(facts(), false, true), false)
  assert.equal(home.homeGuideVisible(null, false), false)
})

test('home task and course links require a real content ref', () => {
  assert.equal(home.homeTaskHref({ id: 't1', status: 'AVAILABLE', contentCode: '' }), null)
  assert.equal(home.homeTaskHref({ id: 't1', status: 'AVAILABLE', contentCode: '   ' }), null)
  assert.equal(home.homeTaskHref({ id: ' ', status: 'AVAILABLE', contentCode: 'c1' }), null)
  assert.equal(home.homeTaskHref({ id: 't1', status: 'LOCKED', contentCode: 'c1' }), null)
  assert.equal(home.homeTaskHref({ id: 't1', status: 'COMPLETED', contentCode: 'c1' }), null)
  assert.equal(home.homeTaskHref({ id: 't1', status: 'UNAVAILABLE', contentCode: 'c1' }), null)
  assert.equal(home.homeTaskHref({ id: 't1', status: 'IN_PROGRESS', contentCode: 'a b' }), '/pages/learn/learn?contentCode=a%20b&taskId=t1')
  assert.equal(home.homeContentHref(''), null)
  assert.equal(home.homeContentHref('  '), null)
  assert.equal(home.homeContentHref(' course '), '/pages/learn/learn?contentCode=course')
})

test('home progress stays empty until server minutes are confirmed', () => {
  const base = { completedMinutes: 0, targetMinutes: 15, stale: false, taskCount: 2 }
  assert.equal(home.homeProgressPercent({ ...base, stale: true }), null)
  assert.equal(home.homeProgressPercent({ ...base, taskCount: 0 }), null)
  assert.equal(home.homeProgressPercent({ ...base, targetMinutes: 0 }), null)
  assert.equal(home.homeProgressPercent({ ...base, completedMinutes: Number.NaN }), null)
  assert.equal(home.homeProgressPercent({ ...base, completedMinutes: 7 }), (7 / 15) * 100)
  assert.equal(home.homeProgressPercent({ ...base, completedMinutes: 40 }), 100)
  assert.equal(Object.hasOwn(home, 'streak'), false)
})

test('a live allowed entry does not read home after the top page leaves', () => {
  assert.equal(home.HOME_PAGE_PATH, '/pages/home/home')
  assert.equal(home.homeStillOnPage('/pages/home/home'), true)
  assert.equal(home.homeStillOnPage('/pages/home/home?x=1'), false)
  assert.equal(home.homeStillOnPage('/pages/settings/settings'), false)
  assert.equal(home.homePrivateReadAllowed('/pages/home/home', true, true), true)
  assert.equal(home.homePrivateReadAllowed('/pages/settings/settings', true, true), false)
  assert.equal(home.homePrivateReadAllowed('/pages/home/home', true, false), false)
  assert.equal(home.homePrivateReadAllowed('/pages/home/home', false, true), false)
})

test('home layout spans keep the phone helper and use the tablet shell classes', () => {
  assert.equal(home.homeLayoutSpan(320), 'compact')
  assert.equal(home.homeLayoutSpan(359), 'compact')
  assert.equal(home.homeLayoutSpan(390), 'phone')
  assert.equal(home.homeLayoutSpan(767), 'phone')
  assert.equal(home.homeLayoutSpan(768), 'tablet')
  assert.equal(home.homeLayoutSpan(1023), 'tablet')
  assert.equal(home.homeLayoutSpan(1024), 'wide')
  assert.match(page, /home-page--\$\{tabletLayout\}/)
  assert.match(page, /home-page--rail/)
  assert.match(page, /home-page--sidebar/)
  assert.doesNotMatch(page, /@media \(min-width: 768px\)/)
  assert.doesNotMatch(page, /@media \(min-width: 1024px\)/)
})

test('home source uses the resume guide and does not paint a demo streak', () => {
  assert.match(page, /showOnboardingGuide\(/)
  assert.match(page, /onboardingRemainingStepLabels\(/)
  assert.match(page, /guideContinueSetup/)
  assert.match(page, /剩余步骤/)
  assert.match(page, /step === 'assessment'/)
  assert.match(page, /homeGuidePath\(/)
  assert.match(page, /homePrivateReadAllowed\(/)
  assert.match(page, /homeTaskHref\(/)
  assert.match(page, /homeContentHref\(/)
  assert.match(page, /homeProgressPercent\(/)
  assert.match(page, /ensureMobilePageAccess\('\/pages\/home\/home'\)/)
  assert.match(page, /store\.loadHome\(\)/)
  assert.match(page, /contentCode/)
  assert.match(page, /watch\(\(\) => session\.identityRevision/)
  assert.doesNotMatch(page, /ONBOARDING_GUIDE_ACTION/)
  assert.doesNotMatch(page, /12天|33%|40%/)
  assert.doesNotMatch(page, /art\.flame|art\.arc|homeDarkAssets\.flame/)
  assert.match(assets, /figma-home-dark-247-1980/)
  assert.doesNotMatch(assets, /export const homeIpad/)
  assert.match(assets, /are not mapped/)
})
