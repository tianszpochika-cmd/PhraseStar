'use strict'

/**
 * G464 home-return decision. Rules are unchanged from the G454 oracle. Pure. No browser, port, or network.
 *
 * The frozen B139 entry route is path "/" with alias "/pages/home/home".
 * A passing hash is that entry path. The alias is required proof that the
 * entry route is Home. The alias is not a second accepted location.hash.
 */

const HOME_ALIAS = '/pages/home/home'
const ENTRY_PATH = '/'
const ENTRY_TITLE = '学习'
const LANDINGS = {
  '/pages/onboarding/onboarding': 'landed-onboarding',
  '/pages/login/login': 'still-login',
  '/pages/forbidden/forbidden': 'landed-forbidden',
  '/pages/today/today': 'landed-today',
  '/pages/learn/learn': 'landed-learn',
  '/pages/assessment/assessment': 'landed-assessment',
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function fail(reason) {
  return { status: 'FAILED', reason }
}

function normalizeRoute(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const path = value.trim().split(/[?#]/, 1)[0]
  if (!path) return null
  return path.startsWith('/') ? path : `/${path}`
}

function hashPath(href) {
  try {
    const url = new URL(href)
    const hash = url.hash.replace(/^#/, '').split('?')[0]
    return hash.startsWith('/') ? hash : null
  } catch {
    return null
  }
}

function originalG405Decision(receipt) {
  const home = isRecord(receipt && receipt.home) ? receipt.home : {}
  if (receipt?.finalHash === '/pages/onboarding/onboarding') return fail('landed-onboarding')
  if (receipt?.finalHash !== HOME_ALIAS) return fail('final-hash')
  if (receipt.loginHttp !== 200 || receipt.loginCount !== 1) return fail('login-http')
  if (receipt.principalHttp !== 200) return fail('principal-http')
  if (receipt.learningAccess !== 'ELIGIBLE' || receipt.serverAdultStatus !== 'PASSED' || receipt.learningPlanRead !== true) {
    return fail('learning-not-eligible')
  }
  if (receipt.homeHttp !== 200 || !(receipt.homeCount >= 1)) return fail('home-http')
  if (home.ok === false) return fail(typeof home.reason === 'string' ? home.reason : 'home-body-missing')
  if (home.state === 'NOT_READY' && home.blocker === 'PLACEMENT_REQUIRED') return fail('placement-required')
  if (home.state !== 'READY') return fail('home-not-ready')
  if (home.targetReady !== true) return fail('target-not-ready')
  if (home.blocker != null) return fail('home-blocker')
  if (!(home.taskCount >= 1) || home.taskCount !== home.tasksLength) return fail('home-task-count')
  if (home.hasPlanningInput !== true || home.hasPlan !== true) return fail('home-plan-missing')
  if (receipt.expectedPlanVersion != null && home.planVersion !== receipt.expectedPlanVersion) return fail('plan-version-mismatch')
  if (receipt.extraWrites > 0) return fail('extra-writes')
  if (receipt.originFixed !== true) return fail('origin')
  return { status: 'OBSERVED', reason: null }
}

function decideHomeReturn(receipt) {
  if (!isRecord(receipt)) return fail('receipt-missing')
  const landing = LANDINGS[receipt.finalHash]
  if (landing) return fail(landing)
  if (receipt.leftLogin !== true) return fail('still-login')
  const entry = isRecord(receipt.entry) ? receipt.entry : null
  if (!entry) return fail('entry-proof-missing')
  if (entry.count !== 1) return fail('entry-count')
  if (entry.alias !== HOME_ALIAS) return fail('entry-alias')
  if (entry.isTabBar !== true || entry.tabBarIndex !== 0) return fail('entry-meta')
  if (entry.titleText !== ENTRY_TITLE) return fail('entry-title')
  if (entry.path !== ENTRY_PATH) return fail('entry-path')
  if (receipt.finalHash !== ENTRY_PATH) return fail('hash-not-entry-path')
  if (receipt.hashStable !== true) return fail('hash-unstable')
  if (!Array.isArray(receipt.hashSamples) || receipt.hashSamples.length < 3) return fail('hash-unstable')
  if (!receipt.hashSamples.every((item) => item === ENTRY_PATH)) return fail('hash-unstable')
  if (normalizeRoute(receipt.pageRoute) !== HOME_ALIAS) return fail('page-route')
  if (receipt.homeVisible !== true) return fail('home-not-visible')
  if (receipt.loginVisible !== false) return fail('login-still-visible')
  if (receipt.routeFulfill !== false || receipt.storageInjection !== false || receipt.locationAssign !== false) {
    return fail('probe-violation')
  }
  if (receipt.loginHttp !== 200 || receipt.loginCount !== 1) return fail('login-http')
  if (receipt.principalHttp !== 200) return fail('principal-http')
  if (receipt.learningAccess !== 'ELIGIBLE' || receipt.serverAdultStatus !== 'PASSED' || receipt.learningPlanRead !== true) {
    return fail('learning-not-eligible')
  }
  if (receipt.homeHttp !== 200 || !(receipt.homeCount >= 1)) return fail('home-http')
  const home = isRecord(receipt.home) ? receipt.home : null
  if (!home || home.ok === false) return fail(home && typeof home.reason === 'string' ? home.reason : 'home-body-missing')
  if (home.state === 'NOT_READY' && home.blocker === 'PLACEMENT_REQUIRED') return fail('placement-required')
  if (home.state !== 'READY') return fail('home-not-ready')
  if (home.profileReady !== true) return fail('profile-not-ready')
  if (home.targetReady !== true) return fail('target-not-ready')
  if (home.placementStatus !== 'COMPLETED') return fail('placement-status')
  if (home.blocker != null) return fail('home-blocker')
  if (!(home.taskCount >= 1) || home.taskCount !== home.tasksLength) return fail('home-task-count')
  if (home.hasPlanningInput !== true || home.hasPlan !== true) return fail('home-plan-missing')
  if (!Number.isInteger(receipt.expectedPlanVersion)) return fail('plan-version-missing')
  if (home.planVersion !== receipt.expectedPlanVersion || home.planVersionMatch !== true) return fail('plan-version-mismatch')
  if (receipt.extraWrites !== 0 || receipt.fulfills !== 0) return fail('extra-writes')
  if (receipt.originFixed !== true || receipt.origin !== 'http://127.0.0.1:18183') return fail('origin')
  if (receipt.loginReturnTo !== HOME_ALIAS) return fail('return-to')
  return { status: 'OBSERVED', reason: null }
}

module.exports = {
  HOME_ALIAS,
  ENTRY_PATH,
  decideHomeReturn,
  hashPath,
  normalizeRoute,
  originalG405Decision,
}
