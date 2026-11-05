import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B10 mobile uses Gateway-relative seams for content, learning and assessment', () => {
  const source = read('src/api/b10.ts')
  assert.match(source, /content:\s*\{/)
  assert.match(source, /learning:\s*\{/)
  assert.match(source, /assessment:\s*\{/)
  assert.match(source, /mobileApiClient\.request/)
  assert.doesNotMatch(source, /https?:\/\/(?!127\.0\.0\.1:18070)/)
  assert.match(source, /Accept-Language/)
  assert.match(source, /contentLocale/)
})

test('B10 mobile mutations carry stable idempotency ids and never send answer keys', () => {
  const api = read('src/api/b10.ts')
  const store = read('src/stores/b10-learning.ts')
  assert.match(api, /Idempotency-Key/)
  assert.match(api, /clientSubmissionId/)
  assert.match(api, /clientEventId/)
  assert.doesNotMatch(api, /correctAnswer|answerKey|standardAnswer/)
  assert.match(store, /reviewStatus === 'ACCEPTED'/)
  assert.match(store, /reviewStatus === 'QUEUED'/)
  assert.match(store, /queuedReviews/) 
})

test('B10 mobile SRS review posts the published event without a top-level item id', () => {
  const api = read('src/api/b10.ts')
  const store = read('src/stores/b10-learning.ts')
  // ReviewEventRequest carries snapshot ids, a tagged item, the observed time and baseStateVersion.
  // POST /learning/srs/reviews sends Idempotency-Key. A top-level itemId is removed and never forwarded.
  assert.match(api, /srsReview: '\/learning\/srs\/reviews'/)
  assert.match(api, /'Idempotency-Key': idempotencyKey\(clientEventId\)/)
  assert.match(api, /const REVIEW_EVENT_KEYS = \['snapshotId', 'snapshotItemId', 'item', 'rawQuality', 'answerOutcome', 'responseTimeMs', 'revealElapsedMs', 'attemptNo', 'clientEventId', 'clientOccurredAt', 'baseStateVersion'\]/)
  assert.match(api, /const SRS_ITEM_TYPES = \['VOCAB', 'CHUNK', 'EXPRESSION'\]/)
  assert.match(api, /if \(itemType === 'VOCAB'\) return \{ itemType, vocabId: itemId \}\s*if \(itemType === 'CHUNK'\) return \{ itemType, chunkId: itemId \}\s*if \(itemType === 'EXPRESSION'\) return \{ itemType, expressionId: itemId \}/)
  assert.match(api, /if \(key !== 'itemId' && !\(REVIEW_EVENT_KEYS as readonly string\[\]\)\.includes\(key\)\) throw fail\(\)/)
  assert.match(api, /snapshotId: card\.snapshotId,\s*snapshotItemId: card\.snapshotItemId,\s*item: srsItemRef\(card\.itemType, card\.itemId\),\s*rawQuality: quality,[\s\S]*?clientOccurredAt: new Date\(\)\.toISOString\(\),\s*baseStateVersion: card\.stateVersion,/)
  assert.match(api, /request<unknown>\(B10_GATEWAY_PATHS\.learning\.srsReview, \{\s*method: 'POST',\s*data: event,\s*header: \{ \.\.\.headers\(context, clientEventId\)/)
  assert.doesNotMatch(api, /data:\s*\{\s*itemId:\s*card\.itemId/)
  assert.match(store, /const REVIEW_WIRE_KEYS = \['snapshotId', 'snapshotItemId', 'item', 'rawQuality', 'answerOutcome', 'responseTimeMs', 'revealElapsedMs', 'attemptNo', 'clientEventId', 'clientOccurredAt', 'baseStateVersion'\]/)
  assert.match(store, /if \(card\.itemType === 'VOCAB'\) return \{ itemType: 'VOCAB', vocabId: card\.itemId \}\s*if \(card\.itemType === 'CHUNK'\) return \{ itemType: 'CHUNK', chunkId: card\.itemId \}\s*if \(card\.itemType === 'EXPRESSION'\) return \{ itemType: 'EXPRESSION', expressionId: card\.itemId \}/)
  assert.match(store, /return \{ snapshotId: card\.snapshotId, snapshotItemId: card\.snapshotItemId, item, rawQuality: quality, answerOutcome: 'REVEALED_WITHOUT_ANSWER', responseTimeMs: 0, revealElapsedMs: 0, clientEventId, clientOccurredAt: new Date\(\)\.toISOString\(\), baseStateVersion: card\.stateVersion \}/)
  assert.doesNotMatch(store, /return \{ itemId: card\.itemId, snapshotId:/)
})

test('B10 mobile covers recovery states, content-version staleness and performance downgrade', () => {
  const domain = read('src/domain/b10.ts')
  const status = read('src/components/b10/B10StatusPanel.vue')
  const exercise = read('src/components/b10/B10ExerciseCard.vue')
  const pages = ['src/pages/b2-vocabulary/b2-vocabulary.vue', 'src/pages/b2-practice/b2-practice.vue', 'src/pages/b3-reading/b3-reading.vue', 'src/pages/b3-grammar/b3-grammar.vue', 'src/pages/b3-writing/b3-writing.vue', 'src/pages/b10-report/b10-report.vue'].map(read).join('\n')
  for (const state of ['offline', 'forbidden', 'stale', 'empty', 'loading']) assert.match(domain + status + pages, new RegExp(state))
  assert.match(domain, /contentVersionStale/)
  assert.match(status, /Performance/)
  assert.match(exercise, /上移|moveToken/)
  assert.match(exercise, /下移|moveToken/)
  assert.match(pages, /b10-theme--/)
  assert.match(pages, /contentLocale/)
})

test('B10 mobile routes expose the report page without a miniapp project', () => {
  const pages = read('src/pages.json')
  assert.match(pages, /pages\/b10-report\/b10-report/)
  assert.doesNotMatch(pages, /miniapp|mini-app|apps\/miniapp-wechat/)
})

test('placement reads an existing session by encoded id and creates only through the session seam', () => {
  const api = read('src/api/learner-content.ts')
  const store = read('src/stores/learner-content.ts')
  // Locale stays on the shared query seam and the contentLocale argument. Placement session
  // routes do not take it, and the client default for a request without a method is GET.
  assert.match(api, /type QueryParams = string \| Record<string, string \| null \| undefined>/)
  assert.match(api, /typeof params === 'string' \? \{ contentLocale: params \} : params/)
  assert.match(api, /void contentLocale\s+if \(!sessionId\) return emptyPlacement\(\)\s+return parsePlacement\(await mobileApiClient\.request<unknown>\(`\/assessment\/placement\/sessions\/\$\{encodeURIComponent\(sessionId\)\}`\)\)/)
  assert.match(api, /request<unknown>\('\/assessment\/placement\/sessions', \{\s*method: 'POST',\s*data: \{\},/)
  assert.doesNotMatch(api, /\/assessment\/placement\/start/)
  assert.match(store, /const contentLocale = await ensureContentLocale\(owner\)/)
  assert.match(store, /if \(sessionId\) \{\s*remote = await mobileLearnerContentApi\.readPlacement\(contentLocale, sessionId\)\s*\} else \{\s*remote = await mobileLearnerContentApi\.startPlacement\(contentLocale, eventId\('mobile-placement-start'\)\)/)
  assert.match(store, /if \(!remote\.report && !remote\.currentQuestion && remote\.sessionId\?\.startsWith\('asess_'\)\) \{\s*remote = await mobileLearnerContentApi\.readPlacement\(contentLocale, remote\.sessionId\)/)
  assert.doesNotMatch(store, /\/assessment\/placement\/start/)
})
