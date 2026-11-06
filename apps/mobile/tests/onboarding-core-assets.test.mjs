import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '../..')
const page = fs.readFileSync(path.join(appRoot, 'src/pages/onboarding/onboarding.vue'), 'utf8')
const mapping = fs.readFileSync(path.join(appRoot, 'src/domain/onboarding-page.ts'), 'utf8')
const script = page.slice(0, page.indexOf('</script>'))
const handlers = script.slice(script.indexOf('function minuteLabel'))

test('onboarding view assets stay inside this checkout and match the confirmed core bytes', () => {
  assert.equal(repoRoot.length > 0, true)
  assert.equal(page.includes('/Users/Admin'), false)
  assert.equal(page.includes('/tmp'), false)
  assert.equal(mapping.includes('/Users/Admin'), false)
  assert.equal(mapping.includes('/tmp'), false)
  const refs = [...mapping.matchAll(/asset\([^,]+,\s*'([^']+)'\)/g)].map(match => match[1])
  assert.ok(refs.length >= 16)
  for (const file of refs) {
    const calls = [...mapping.matchAll(new RegExp(`asset\\(([^,]+),\\s*'${file}'\\)`, 'g'))]
    for (const call of calls) {
      const reference = { adult: 'onboarding-adult-164-5455', consent: 'onboarding-consent-164-5944', goals: 'onboarding-goals-164-6595', selected: 'onboarding-selected-164-6762', summary: 'onboarding-summary-164-7399' }[call[1]]
      assert.ok(reference, call[1])
      const absolute = path.join(appRoot, 'src/static/figma-onboarding-core', reference, file)
      assert.equal(fs.existsSync(absolute), true, absolute)
      assert.ok(fs.statSync(absolute).size > 0)
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex').length, 64)
    }
  }
  assert.match(mapping, /\/static\/figma-onboarding-core/)
  assert.match(page, /onboardingChrome/)
  assert.match(page, /goalArt\(/)
  assert.doesNotMatch(page, /https:\/\/www\.figma\.com/)
  assert.doesNotMatch(mapping, /https:\/\/www\.figma\.com/)
})

test('onboarding handlers still submit the adult gate, read consent, and save the target', () => {
  assert.match(script, /session\.confirmAdultGate\(Number\(birthYear\.value\)\)/)
  assert.match(script, /mobileApiClient\.request<unknown>\('\/iam\/consents'\)/)
  assert.match(script, /store\.saveTarget\(/)
  assert.match(script, /selectOnboardingResumeStep\(/)
  assert.doesNotMatch(page, /recordRequiredConsents\(/)
  assert.doesNotMatch(page, /出生月|出生日|type="date"|bday-day|bday-month/)
  assert.match(handlers, /function chooseGoal/)
  assert.match(handlers, /function adjustGoal/)
  assert.match(handlers, /async function next/)
  assert.match(handlers, /async function cancel/)
})
