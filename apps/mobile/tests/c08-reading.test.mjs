import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relative) => fs.readFileSync(path.join(appRoot, relative), 'utf8')

/**
 * Drift: the old pages called mine(block) and saveReadingPosition, and B11 mounted B11StatusPanel.
 * Those were clickable writes. This card closes them. The assertions below keep the API, panel, and
 * store facts, and require the pages to avoid those writes and any server-save claim.
 */
test('C08 mobile B3 reading keeps recovery explicit and does not invoke mining', () => {
  const page = read('src/pages/b3-reading/b3-reading.vue')
  const api = read('src/api/b10.ts')
  assert.match(page, /shell === 'empty'/)
  assert.match(page, /role="alert"/)
  assert.match(page, /data-action="select-word"/)
  assert.match(page, /data-selection-persisted="false"/)
  assert.match(page, /data-write-capability="closed"/)
  assert.match(page, /data-server-receipt="none"/)
  assert.match(page, /currentMobilePagePath\(\)/)
  assert.doesNotMatch(page, /currentMobilePagePath\(ROUTE_PATH\)/)
  assert.doesNotMatch(page, /mine\(|mineReadingExpression|saveReadingProgress|submitReadingAttempt|saveReadingPosition/)
  assert.match(api, /mineReadingExpression[\s\S]*selectedText, contentVersionId/)
  assert.match(api, /async saveReadingProgress[\s\S]*method: 'PUT'/)
  assert.match(api, /async submitReadingAttempt[\s\S]*unavailableOperation/)
})

test('C08 mobile B11 reading stays closed while the untouched panel and store still own progress', () => {
  const page = read('src/pages/b11-reading/b11-reading.vue')
  const statusPanel = read('src/components/b11/B11StatusPanel.vue')
  const store = read('src/stores/b11-learning.ts')
  assert.equal((page.match(/<B11StatusPanel\b/g) ?? []).length, 0)
  assert.doesNotMatch(page, /readingStatus === 'empty'/)
  assert.doesNotMatch(page, /saveReadingPosition|saveReadingProgress|submitReadingAttempt|mineReadingExpression/)
  assert.match(page, /b11-reading/)
  assert.match(page, /blockIndex/)
  assert.match(page, /data-write-capability="closed"/)
  assert.match(page, /data-server-receipt="none"/)
  assert.match(page, /currentMobilePagePath\(\)/)
  assert.match(statusPanel, /role="status"/)
  assert.match(statusPanel, /emit\('retry'\)/)
  assert.match(store, /readingBlockIndex/)
  assert.match(store, /readingProgress/)
  assert.match(store, /saveReadingPosition/)
})
