'use strict'
/**
 * G446 published-practice one-option-click observer.
 *
 * Node runs this file only. It checks the pinned G280 observer bytes, applies
 * the unchanged G325/G338 uni-button CTA seam from G360, then one visible
 * CHOICE click after same-session readback. That click is the submit. There is
 * no second submit control. One POST /attempts is continued, feedback nodes
 * are required, and the same Idempotency-Key plus body are replayed. Article
 * leaks, OUTPUT_LEAKS, and the raw answer-key checks stay. No class or
 * attribute is written into the page.
 */
const fs = require('node:fs')
const crypto = require('node:crypto')
const Module = require('node:module')

const FROZEN = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs'
const FROZEN_SHA = '679db31207ef097a117170a88b1ba2d305f0755b7f2ddc38f5c070be91573137'
const G360_WRAPPER = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-integrated-h5-runtime-pin-360-frozen/reading-practice-h5.cjs'
const G360_WRAPPER_SHA = 'fa504d284cbcd8fe9a56c9f32cf0c1d5c871b53dc288a2f60a858c557b3ac0a1'
const G399_SNAPSHOT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/user-pause-20261106/worker-snapshots/399/reading-practice-h5.cjs'
const G399_SNAPSHOT_SHA = 'fa504d284cbcd8fe9a56c9f32cf0c1d5c871b53dc288a2f60a858c557b3ac0a1'

function failClosed() {
  process.stdout.write(`${JSON.stringify({
    status: 'FAILED',
    reason: 'observer-failed',
    publishedDetail: 'not-this-proof',
    practiceEntry: 'not-this-proof',
    proof: 'B118-mb014-mb011-published-practice',
    syntheticFulfills: 0,
  })}\n`)
  process.exit(1)
}

function once(source, needle, replacement) {
  const at = source.indexOf(needle)
  if (at < 0 || source.indexOf(needle, at + needle.length) !== -1) return null
  return source.slice(0, at) + replacement + source.slice(at + needle.length)
}

function pinBytes(path, digest) {
  let listed
  let real
  try {
    listed = fs.lstatSync(path)
    real = fs.realpathSync(path)
  } catch {
    return false
  }
  if (listed.isSymbolicLink() || real !== path || !listed.isFile()) return false
  const bytes = fs.readFileSync(path)
  const got = crypto.createHash('sha256').update(bytes).digest('hex')
  return got === digest
}

function ctaSource() {
  return [
    'function primitiveCta(cta) {',
    '  const tags = cta && cta.tags && typeof cta.tags === \'object\' ? cta.tags : {}',
    '  const button = Number.isInteger(tags.button) && tags.button >= 0 ? tags.button : 0',
    '  const uniButton = Number.isInteger(tags.uniButton) && tags.uniButton >= 0 ? tags.uniButton : 0',
    '  const other = Number.isInteger(tags.other) && tags.other >= 0 ? tags.other : 0',
    '  const allowed = new Set([\'button\', \'uni-button\', \'other\', \'mixed\', \'none\'])',
    '  const tag = cta && allowed.has(cta.tag) ? cta.tag : \'none\'',
    '  return {',
    '    count: cta && Number.isInteger(cta.count) && cta.count >= 0 ? cta.count : 0,',
    '    tag,',
    '    tags: { button, uniButton, other },',
    '    visible: Boolean(cta && cta.visible === true),',
    '    disabled: Boolean(cta && (cta.disabled === true || cta.closed === true)),',
    '    openLabel: Boolean(cta && cta.openLabel === true),',
    '    closedLabel: Boolean(cta && cta.closedLabel === true),',
    '  }',
    '}',
    '',
    'async function readPracticeCta(page) {',
    '  return page.evaluate((labels) => {',
    '    const shown = (node) => {',
    '      const view = node.ownerDocument && node.ownerDocument.defaultView',
    '      const style = view ? view.getComputedStyle(node) : null',
    '      return Boolean(style && style.display !== \'none\' && style.visibility !== \'hidden\' && node.getClientRects().length > 0)',
    '    }',
    '    const classify = (node) => {',
    '      const tag = String(node.tagName || \'\').toLowerCase()',
    '      if (tag === \'button\') return \'button\'',
    '      if (tag === \'uni-button\') return \'uni-button\'',
    '      return \'other\'',
    '    }',
    '    const tally = (nodes) => {',
    '      const tags = { button: 0, uniButton: 0, other: 0 }',
    '      for (const node of nodes) {',
    '        const kind = classify(node)',
    '        if (kind === \'button\') tags.button += 1',
    '        else if (kind === \'uni-button\') tags.uniButton += 1',
    '        else tags.other += 1',
    '      }',
    '      const kinds = [tags.button ? \'button\' : \'\', tags.uniButton ? \'uni-button\' : \'\', tags.other ? \'other\' : \'\'].filter(Boolean)',
    '      const tag = nodes.length === 0 ? \'none\' : kinds.length === 1 ? kinds[0] : \'mixed\'',
    '      return { tags, tag }',
    '    }',
    '    const blank = { count: 0, tag: \'none\', tags: { button: 0, uniButton: 0, other: 0 }, visible: false, disabled: false, closed: false, openLabel: false, closedLabel: false }',
    '    const pages = [...document.querySelectorAll(\'.reading-page[data-route="b3-reading"]\')]',
    '    const visiblePages = pages.filter(shown)',
    '    const every = pages.flatMap((root) => [...root.querySelectorAll(\'.reading-cta[data-action="published-practice"]\')])',
    '    if (visiblePages.length !== 1) {',
    '      const summary = tally(every)',
    '      return { count: every.length, tag: summary.tag, tags: summary.tags, visible: false, disabled: false, closed: false, openLabel: false, closedLabel: false }',
    '    }',
    '    const root = visiblePages[0]',
    '    const nodes = [...root.querySelectorAll(\'.reading-cta[data-action="published-practice"]\')]',
    '    if (every.length !== nodes.length) {',
    '      const summary = tally(every)',
    '      return { count: every.length, tag: summary.tag, tags: summary.tags, visible: false, disabled: false, closed: false, openLabel: false, closedLabel: false }',
    '    }',
    '    const summary = tally(nodes)',
    '    if (nodes.length !== 1) {',
    '      return { count: nodes.length, tag: summary.tag, tags: summary.tags, visible: false, disabled: false, closed: false, openLabel: false, closedLabel: false }',
    '    }',
    '    const node = nodes[0]',
    '    const visible = shown(node)',
    '    const text = (node.textContent || \'\').replace(/\\s+/g, \' \').trim()',
    '    const disabled = node.disabled === true || node.hasAttribute(\'disabled\') || node.getAttribute(\'aria-disabled\') === \'true\'',
    '    return {',
    '      count: 1,',
    '      tag: summary.tag,',
    '      tags: summary.tags,',
    '      visible,',
    '      disabled,',
    '      closed: disabled,',
    '      openLabel: labels.open.includes(text),',
    '      closedLabel: labels.closed.includes(text),',
    '    }',
    '  }, { closed: CLOSED_LABELS, open: OPEN_LABELS }).catch(() => null)',
    '}',
    '',
    'async function settleLiveDetailCta(page, deadline, detailReady) {',
    '  const boundEnd = Math.min(deadline, Date.now() + 3000)',
    '  let previous = \'\'',
    '  let snap = await readPracticeCta(page)',
    '  for (;;) {',
    '    const signature = snap',
    '      ? [snap.count, snap.tag, snap.visible === true, snap.disabled === true, snap.openLabel === true, snap.closedLabel === true].join(\'|\')',
    '      : \'null\'',
    '    const stable = signature === previous && snap && snap.count === 1 && snap.visible === true',
    '    previous = signature',
    '    if (detailReady() && stable) return snap',
    '    if (Date.now() >= boundEnd) return snap',
    '    await new Promise((resolve) => setTimeout(resolve, 100))',
    '    snap = await readPracticeCta(page)',
    '  }',
    '}',
  ].join('\n')
}

function activationSource() {
  return [
    '      let practiceHandle = null',
    '      try {',
    '        practiceHandle = await page.evaluateHandle(() => {',
    '          const shown = (node) => {',
    '            const view = node.ownerDocument && node.ownerDocument.defaultView',
    '            const style = view ? view.getComputedStyle(node) : null',
    '            return Boolean(style && style.display !== \'none\' && style.visibility !== \'hidden\' && node.getClientRects().length > 0)',
    '          }',
    '          const pages = [...document.querySelectorAll(\'.reading-page[data-route="b3-reading"]\')].filter(shown)',
    '          if (pages.length !== 1) return null',
    '          const nodes = [...pages[0].querySelectorAll(\'.reading-cta[data-action="published-practice"]\')]',
    '          if (nodes.length !== 1 || !shown(nodes[0])) return null',
    '          const node = nodes[0]',
    '          if (node.disabled === true || node.hasAttribute(\'disabled\') || node.getAttribute(\'aria-disabled\') === \'true\') return null',
    '          return node',
    '        })',
    '        const target = practiceHandle.asElement()',
    '        if (!target) throw new Error(\'cta-target\')',
    '        await target.focus()',
    '        await page.keyboard.press(\'Enter\')',
    '        ui.cta = { ...ui.cta, gesture: \'keyboard\', gestureCount: 1 }',
    '      } catch {',
    '        practiceGate.opened = false',
    '        outcome = finish(\'FAILED\', \'cta-not-activated\')',
    '        return outcome',
    '      } finally {',
    '        if (practiceHandle) await practiceHandle.dispose().catch(() => {})',
    '      }',
  ].join('\n')
}

function attemptHelpersSource() {
  return [
    '  if (parsed.clientSessionRef !== `h5-reading-${version}-${ITEM_ID}`) return \'rejected\'',
    '  return \'pinned\'',
    '}',
    '',
    'function attemptBodyVerdict(raw) {',
    '  if (typeof raw !== \'string\' || raw.length === 0 || raw.length > 4096) return \'rejected\'',
    '  if (SESSION_LEAKS.some((snippet) => raw.includes(snippet))) return \'rejected\'',
    '  let parsed',
    '  try { parsed = JSON.parse(raw) } catch { return \'rejected\' }',
    '  if (!parsed || typeof parsed !== \'object\' || Array.isArray(parsed)) return \'rejected\'',
    '  if (parsed.expectedStateVersion !== 1) return \'rejected\'',
    '  if (typeof parsed.submissionId !== \'string\' || parsed.submissionId.length < 8 || parsed.submissionId.length > 128) return \'rejected\'',
    '  if (!Array.isArray(parsed.items) || parsed.items.length !== 1) return \'rejected\'',
    '  const item = parsed.items[0]',
    '  if (!item || typeof item !== \'object\' || Array.isArray(item)) return \'rejected\'',
    '  if (item.itemId !== ITEM_ID || item.sequence !== 0) return \'rejected\'',
    '  const response = item.response',
    '  if (!response || typeof response !== \'object\' || Array.isArray(response)) return \'rejected\'',
    '  const selected = response.selectedOptionKeys',
    '  if (!Array.isArray(selected) || selected.length !== 1) return \'rejected\'',
    '  if (typeof selected[0] !== \'string\' || !/^[a-z][a-z0-9._:-]{0,63}$/.test(selected[0])) return \'rejected\'',
    '  if (/[\\r\\n\\0]/.test(selected[0])) return \'rejected\'',
    '  return \'ok\'',
    '}',
    '',
    'function safeAttemptProbe(traffic) {',
    '  const closed = []',
    '  for (const row of traffic) {',
    '    if (closed.length >= 8) break',
    '    const attemptish = row.type === \'attempt-post\' || row.type === \'attempt-replay\' || (row.disposition === \'abort\' && (row.type === \'excluded-write\' || (typeof row.reason === \'string\' && row.reason.startsWith(\'attempt-\'))))',
    '    if (!attemptish) continue',
    '    closed.push({',
    '      type: typeof row.type === \'string\' && row.type.length <= 40 ? row.type : null,',
    '      disposition: row.disposition === \'abort\' || row.disposition === \'continue\' ? row.disposition : null,',
    '      reason: typeof row.reason === \'string\' && row.reason.length <= 40 ? row.reason : null,',
    '      method: row.method === \'POST\' || row.method === \'GET\' || row.method === \'PUT\' || row.method === \'OPTIONS\' ? row.method : null,',
    '      status: Number.isInteger(row.status) ? row.status : null,',
    '      host: row.host === \'127.0.0.1\' ? \'127.0.0.1\' : null,',
    '      pathShape: typeof row.path === \'string\' && row.path.length <= 96 ? row.path : null,',
    '    })',
    '  }',
    '  return {',
    '    abortedWrites: traffic.filter((row) => row.disposition === \'abort\' && row.type === \'excluded-write\').length,',
    '    attemptPosts: traffic.filter((row) => row.type === \'attempt-post\' && row.disposition === \'continue\').length,',
    '    closed,',
    '  }',
    '}',
    '',
    'function attemptFacts(raw) {',
    '  if (typeof raw !== \'string\' || raw.length === 0 || raw.length > 65536) return { leak: true }',
    '  if (SESSION_LEAKS.some((snippet) => raw.includes(snippet))) return { leak: true }',
    '  if (FORBIDDEN_SNIPPETS.some((snippet) => raw.includes(snippet))) return { leak: true }',
    '  let parsed',
    '  try { parsed = JSON.parse(raw) } catch { return null }',
    '  const data = parsed && parsed.data',
    '  if (!data || typeof data !== \'object\' || Array.isArray(data)) return null',
    '  if (typeof data.attemptId !== \'string\' || !/^aatm_[0-9a-f]{32}$/.test(data.attemptId)) return null',
    '  if (typeof data.sessionId !== \'string\' || !/^asess_[0-9a-f]{32}$/.test(data.sessionId)) return null',
    '  if (data.status !== \'ASSESSED\' || data.savedReceipt !== \'已保存\') return null',
    '  if (data.scoreBucket !== \'FULL\' && data.scoreBucket !== \'ZERO\') return null',
    '  return {',
    '    leak: false,',
    '    attemptSha256: shaText(data.attemptId),',
    '    savedReceipt: true,',
    '    scoreBucket: data.scoreBucket,',
    '    status: data.status,',
    '  }',
    '}',
    '',
    'async function clickVisibleChoice(page) {',
    '  let handle = null',
    '  try {',
    '    handle = await page.evaluateHandle(() => {',
    '      const shown = (node) => {',
    '        const view = node.ownerDocument && node.ownerDocument.defaultView',
    '        const style = view ? view.getComputedStyle(node) : null',
    '        return Boolean(style && style.display !== \'none\' && style.visibility !== \'hidden\' && node.getClientRects().length > 0)',
    '      }',
    '      const roots = [...document.querySelectorAll(\'[data-panel="exercise"]\')].filter(shown)',
    '      if (roots.length !== 1) return null',
    '      const root = roots[0]',
    '      const extra = [...root.querySelectorAll(\'.b10-submit, .v2-b2p-submit\')].filter(shown)',
    '      if (extra.length !== 0) return { blocked: true }',
    '      const options = [...root.querySelectorAll(\'.b10-exercise-card .b10-option\')].filter(shown)',
    '      if (options.length < 1) return null',
    '      const node = options[0]',
    '      if (node.disabled === true || node.hasAttribute(\'disabled\') || node.getAttribute(\'aria-disabled\') === \'true\') return null',
    '      return node',
    '    })',
    '    const target = handle.asElement()',
    '    if (!target) {',
    '      const boxed = await handle.jsonValue().catch(() => null)',
    '      if (boxed && boxed.blocked === true) return \'second-submit-present\'',
    '      return \'choice-target\'',
    '    }',
    '    await target.click()',
    '    return \'clicked\'',
    '  } catch {',
    '    return \'choice-not-clicked\'',
    '  } finally {',
    '    if (handle) await handle.dispose().catch(() => {})',
    '  }',
    '}',
    '',
    'async function readFeedback(page, deadline) {',
    '  const boundEnd = Math.min(deadline, Date.now() + 8000)',
    '  for (;;) {',
    '    const snap = await page.evaluate(() => {',
    '      const save = document.querySelector(\'[data-save-receipt]\')',
    '      const words = document.querySelector(\'[data-feedback-text]\')',
    '      const shown = (node) => {',
    '        if (!node) return false',
    '        const view = node.ownerDocument && node.ownerDocument.defaultView',
    '        const style = view ? view.getComputedStyle(node) : null',
    '        return Boolean(style && style.display !== \'none\' && style.visibility !== \'hidden\' && node.getClientRects().length > 0)',
    '      }',
    '      const saveText = save ? (save.textContent || \'\').replace(/\\s+/g, \' \').trim() : \'\'',
    '      const feedbackText = words ? (words.textContent || \'\').replace(/\\s+/g, \' \').trim() : \'\'',
    '      return {',
    '        saveVisible: shown(save),',
    '        feedbackVisible: shown(words),',
    '        saved: saveText === \'已保存\',',
    '        feedbackPresent: feedbackText.length > 0 && feedbackText.length <= 40,',
    '      }',
    '    }).catch(() => null)',
    '    if (snap && snap.saveVisible === true && snap.feedbackVisible === true && snap.saved === true && snap.feedbackPresent === true) return snap',
    '    if (Date.now() >= boundEnd) return snap',
    '    await new Promise((resolve) => setTimeout(resolve, 100))',
    '  }',
    '}',
  ].join('\n')
}

function loadFrozen() {
  let listed
  let real
  try {
    listed = fs.lstatSync(FROZEN)
    real = fs.realpathSync(FROZEN)
  } catch {
    return null
  }
  if (listed.isSymbolicLink() || real !== FROZEN || !listed.isFile()) return null
  const bytes = fs.readFileSync(FROZEN)
  const digest = crypto.createHash('sha256').update(bytes).digest('hex')
  if (digest !== FROZEN_SHA) return null
  return bytes.toString('utf8')
}

function patch(source) {
  let next = once(source, [
    'async function readPracticeCta(page) {',
    '  return page.evaluate((labels) => {',
    '    const nodes = [...document.querySelectorAll(\'button.reading-cta[data-action="published-practice"]\')]',
    '    if (nodes.length !== 1) return { count: nodes.length, visible: false, closed: false, closedLabel: false, openLabel: false }',
    '    const node = nodes[0]',
    '    const view = node.ownerDocument && node.ownerDocument.defaultView',
    '    const style = view ? view.getComputedStyle(node) : null',
    '    const visible = Boolean(style && style.display !== \'none\' && style.visibility !== \'hidden\' && node.getClientRects().length > 0)',
    '    const text = (node.textContent || \'\').replace(/\\s+/g, \' \').trim()',
    '    const disabled = node.disabled === true || node.getAttribute(\'aria-disabled\') === \'true\'',
    '    return {',
    '      count: 1,',
    '      visible,',
    '      closed: disabled,',
    '      closedLabel: labels.closed.includes(text),',
    '      openLabel: labels.open.includes(text),',
    '    }',
    '  }, { closed: CLOSED_LABELS, open: OPEN_LABELS }).catch(() => null)',
    '}',
  ].join('\n'), ctaSource())
  if (next == null) return null
  next = once(next, [
    '      ui.surface = await readPublishedUi(page)',
    '      ui.cta = await readPracticeCta(page)',
  ].join('\n'), [
    '      ui.surface = await readPublishedUi(page)',
    '      ui.cta = await settleLiveDetailCta(page, deadline, () => reading.some((row) => row.kind === \'detail\'))',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '      const cta = page.locator(\'button.reading-cta[data-action="published-practice"]\')',
    '      try {',
    '        await cta.focus()',
    '        await page.keyboard.press(\'Enter\')',
    '        ui.cta = { ...ui.cta, gesture: \'keyboard\', gestureCount: 1 }',
    '      } catch {',
    '        practiceGate.opened = false',
    '        outcome = finish(\'FAILED\', \'cta-not-activated\')',
    '        return outcome',
    '      }',
  ].join('\n'), activationSource())
  if (next == null) return null
  next = once(
    next,
    '    const finish = (status, reason, publishedDetail, practiceEntry) => ({',
    '    const finish = (status, reason, publishedDetail, practiceEntry) => {\n      const result = ({',
  )
  if (next == null) return null
  next = once(next, [
    '      requests: traffic,',
    '      browserCloseRaced: false,',
    '    })',
  ].join('\n'), [
    '      requests: traffic,',
    '      browserCloseRaced: false,',
    '    })',
    '      if (typeof reason === \'string\' && reason.startsWith(\'cta-\')) result.cta = primitiveCta(ui.cta)',
    '      if (typeof reason === \'string\' && (reason.startsWith(\'choice-\') || reason.startsWith(\'attempt-\') || reason.startsWith(\'feedback-\') || reason === \'second-submit-present\')) {',
    '        result.choice = ui.choice && ui.choice.gesture === \'click\' ? { gesture: \'click\', gestureCount: 1 } : { gesture: \'none\', gestureCount: 0 }',
    '      }',
    '      return result',
    '    }',
  ].join('\n'))
  if (next == null) return null
  next = once(next, 'if (require.main === module) {', 'if (true) {')
  if (next == null) return null
  next = once(next, [
    'const SESSION_LEAKS = [',
    '  \'"ruleDigest"\', \'"answerRule"\', \'"answer_rule"\', \'"correctOption"\', \'"correctKey"\', \'"acceptedKeys"\',',
    '  \'"gradableQuestions"\', \'readingRuleSeal\', \'Owner stem\',',
    ']',
  ].join('\n'), [
    'const SESSION_LEAKS = [',
    '  \'"ruleDigest"\', \'"answerRule"\', \'"answer_rule"\', \'"correctOption"\', \'"correctKey"\', \'"acceptedKeys"\',',
    '  \'"gradableQuestions"\', \'readingRuleSeal\',',
    ']',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '  if (parsed.clientSessionRef !== `h5-reading-${version}-${ITEM_ID}`) return \'rejected\'',
    '  return \'pinned\'',
    '}',
  ].join('\n'), attemptHelpersSource())
  if (next == null) return null
  next = once(next, [
    '  const practiceGate = {',
    '    opened: false,',
    '    version: null,',
    '    postContinued: 0,',
    '    getContinued: 0,',
    '    legacy: 0,',
    '    rejected: 0,',
    '    sessionId: \'\',',
    '    sessionSha256: null,',
    '    getPathSha: null,',
    '    questionSha256: null,',
    '  }',
  ].join('\n'), [
    '  const practiceGate = {',
    '    opened: false,',
    '    version: null,',
    '    postContinued: 0,',
    '    getContinued: 0,',
    '    legacy: 0,',
    '    rejected: 0,',
    '    sessionId: \'\',',
    '    sessionSha256: null,',
    '    getPathSha: null,',
    '    questionSha256: null,',
    '    attemptContinued: 0,',
    '    attemptReplayContinued: 0,',
    '    attemptKey: \'\',',
    '    attemptBody: \'\',',
    '    attemptUrl: \'\',',
    '    attemptAuth: \'\',',
    '    attemptOrigin: \'\',',
    '    attemptType: \'\',',
    '    attemptSha256: null,',
    '    replaySha256: null,',
    '    scoreBucket: null,',
    '  }',
  ].join('\n'))
  if (next == null) return null
  next = once(next, '    const ui = { loginLeft: false, entry: null, routeMatch: false, surface: null, cta: null, practice: null }', '    const ui = { loginLeft: false, entry: null, routeMatch: false, surface: null, cta: null, practice: null, choice: null, feedback: null }')
  if (next == null) return null
  next = once(next, [
    '        questionSha256: questionSame ? post.questionSha256 : null,',
    '        sameSession,',
    '      }',
    '    }',
  ].join('\n'), [
    '        questionSha256: questionSame ? post.questionSha256 : null,',
    '        sameSession,',
    '        choiceGesture: ui.choice && ui.choice.gesture === \'click\' ? \'click\' : \'none\',',
    '        choiceCount: ui.choice && ui.choice.gesture === \'click\' ? 1 : 0,',
    '        attemptStatus: (() => { const row = traffic.find((item) => item.type === \'attempt-post\' && item.disposition === \'continue\'); return row && Number.isInteger(row.status) ? row.status : null })(),',
    '        replayStatus: (() => { const row = traffic.find((item) => item.type === \'attempt-replay\' && item.disposition === \'continue\'); return row && Number.isInteger(row.status) ? row.status : null })(),',
    '        savedReceipt: ui.feedback && ui.feedback.saved === true,',
    '        feedbackVisible: ui.feedback && ui.feedback.visible === true,',
    '        sameAttempt: Boolean(practiceGate.attemptSha256 && practiceGate.replaySha256 && practiceGate.attemptSha256 === practiceGate.replaySha256),',
    '        scoreBucket: practiceGate.scoreBucket === \'FULL\' || practiceGate.scoreBucket === \'ZERO\' ? practiceGate.scoreBucket : null,',
    '      }',
    '    }',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '        practicePosts: traffic.filter((row) => row.type === \'practice-post\' && row.disposition === \'continue\').length,',
    '        practiceGets: traffic.filter((row) => row.type === \'practice-get\' && row.disposition === \'continue\').length,',
    '        legacyCreates: traffic.filter((row) => row.reason === \'legacy-create\').length,',
    '        attemptWrites: traffic.filter((row) => row.reason === \'attempt-write-closed\' || row.reason === \'checkpoint-write-closed\').length,',
  ].join('\n'), [
    '        practicePosts: traffic.filter((row) => row.type === \'practice-post\' && row.disposition === \'continue\').length,',
    '        practiceGets: traffic.filter((row) => row.type === \'practice-get\' && row.disposition === \'continue\').length,',
    '        legacyCreates: traffic.filter((row) => row.reason === \'legacy-create\').length,',
    '        attemptPosts: traffic.filter((row) => row.type === \'attempt-post\' && row.disposition === \'continue\').length,',
    '        attemptReplays: traffic.filter((row) => row.type === \'attempt-replay\' && row.disposition === \'continue\').length,',
    '        attemptWrites: traffic.filter((row) => row.reason === \'attempt-write-closed\' || row.reason === \'checkpoint-write-closed\').length,',
  ].join('\n'))
  if (next == null) return null
  next = once(next, '      const continuedTypes = new Set([\'iam-login\', \'iam-refresh\', \'gateway-session\', \'gateway-reading-articles\', \'gateway-reading-article\', \'h5-static\', \'practice-post\', \'practice-get\', \'practice-preflight\'])', '      const continuedTypes = new Set([\'iam-login\', \'iam-refresh\', \'gateway-session\', \'gateway-reading-articles\', \'gateway-reading-article\', \'h5-static\', \'practice-post\', \'practice-get\', \'practice-preflight\', \'attempt-post\', \'attempt-replay\'])')
  if (next == null) return null
  next = once(next, '        return row.type !== \'iam-login\' && row.type !== \'iam-refresh\' && row.type !== \'practice-post\'', '        return row.type !== \'iam-login\' && row.type !== \'iam-refresh\' && row.type !== \'practice-post\' && row.type !== \'attempt-post\' && row.type !== \'attempt-replay\'')
  if (next == null) return null
  next = once(next, [
    '    const note = (method, requestPath, rowOutcome) => {',
    '      if (traffic.length >= 160) return null',
    '      const row = {',
    '        order: ++order,',
    '        method,',
    '        path: publicPath(requestPath),',
    '        status: rowOutcome.status ?? null,',
    '        type: rowOutcome.type,',
    '        disposition: rowOutcome.disposition,',
    '        reason: rowOutcome.reason || null,',
    '      }',
    '      traffic.push(row)',
    '      return row',
    '    }',
  ].join('\n'), [
    '    const note = (method, requestPath, rowOutcome) => {',
    '      if (traffic.length >= 160) return null',
    '      const row = {',
    '        order: ++order,',
    '        method,',
    '        path: publicPath(requestPath),',
    '        status: rowOutcome.status ?? null,',
    '        type: rowOutcome.type,',
    '        disposition: rowOutcome.disposition,',
    '        reason: rowOutcome.reason || null,',
    '        host: rowOutcome.host === \'127.0.0.1\' ? \'127.0.0.1\' : null,',
    '      }',
    '      traffic.push(row)',
    '      return row',
    '    }',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '            if (session && session.tail === \'/attempts\' && method === \'POST\') {',
    '              await route.abort()',
    '              note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'attempt-write-closed\' })',
    '              return',
    '            }',
  ].join('\n'), [
    '            if (session && session.tail === \'/attempts\' && method === \'POST\') {',
    '              if (!practiceGate.opened || !practiceGate.sessionId || session.id !== practiceGate.sessionId) {',
    '                await route.abort()',
    '                note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'attempt-write-closed\', host: url.hostname })',
    '                return',
    '              }',
    '              if (decision.query !== \'none\') {',
    '                await route.abort()',
    '                note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'unexpected-query\', host: url.hostname })',
    '                return',
    '              }',
    '              if (needsAuth && !hasAuthorization(request)) {',
    '                await route.abort()',
    '                note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'missing-authorization\', host: url.hostname })',
    '                return',
    '              }',
    '              const raw = request.postData() || \'\'',
    '              const idempotency = request.headers()[\'idempotency-key\']',
    '              if (typeof idempotency !== \'string\' || idempotency.length < 8 || idempotency.length > 128 || /[\\r\\n\\0]/.test(idempotency)) {',
    '                await route.abort()',
    '                note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'attempt-key-rejected\', host: url.hostname })',
    '                return',
    '              }',
    '              if (practiceGate.attemptContinued === 0) {',
    '                if (attemptBodyVerdict(raw) !== \'ok\') {',
    '                  await route.abort()',
    '                  note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'attempt-body-rejected\', host: url.hostname })',
    '                  return',
    '                }',
    '                practiceGate.attemptContinued = 1',
    '                practiceGate.attemptKey = idempotency',
    '                practiceGate.attemptBody = raw',
    '                practiceGate.attemptUrl = request.url()',
    '                practiceGate.attemptAuth = request.headers().authorization || \'\'',
    '                practiceGate.attemptOrigin = request.headers().origin || PAGE_ORIGIN',
    '                practiceGate.attemptType = request.headers()[\'content-type\'] || \'application/json\'',
    '                const row = note(method, url.pathname, { type: \'attempt-post\', disposition: \'continue\', reason: null, host: url.hostname })',
    '                if (row) {',
    '                  const queued = pending.get(`${method} ${url.pathname}`) || []',
    '                  queued.push(row)',
    '                  pending.set(`${method} ${url.pathname}`, queued)',
    '                }',
    '                await route.continue()',
    '                return',
    '              }',
    '              if (practiceGate.attemptContinued === 1 && practiceGate.attemptReplayContinued === 0 && idempotency === practiceGate.attemptKey && raw === practiceGate.attemptBody) {',
    '                practiceGate.attemptReplayContinued = 1',
    '                const row = note(method, url.pathname, { type: \'attempt-replay\', disposition: \'continue\', reason: null, host: url.hostname })',
    '                if (row) {',
    '                  const queued = pending.get(`${method} ${url.pathname}`) || []',
    '                  queued.push(row)',
    '                  pending.set(`${method} ${url.pathname}`, queued)',
    '                }',
    '                await route.continue()',
    '                return',
    '              }',
    '              await route.abort()',
    '              note(method, url.pathname, { type: \'excluded-write\', disposition: \'abort\', reason: \'attempt-write-closed\', host: url.hostname })',
    '              return',
    '            }',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '        const practiceKind = parsed.origin === GATEWAY_ORIGIN && parsed.pathname === SESSION_COLLECTION && method === \'POST\'',
    '          ? \'post\'',
    '          : session && session.id && session.tail === \'\' && method === \'GET\'',
    '            ? \'get\'',
    '            : null',
    '        if (!practiceKind) return',
  ].join('\n'), [
    '        const practiceKind = parsed.origin === GATEWAY_ORIGIN && parsed.pathname === SESSION_COLLECTION && method === \'POST\'',
    '          ? \'post\'',
    '          : session && session.id && session.tail === \'\' && method === \'GET\'',
    '            ? \'get\'',
    '            : null',
    '        if (parsed.origin === GATEWAY_ORIGIN && session && session.tail === \'/attempts\' && method === \'POST\') {',
    '          const status = response.status()',
    '          practiceTasks.push((async () => {',
    '            let facts = null',
    '            if (status === 200) {',
    '              try { facts = attemptFacts(await response.text()) } catch { facts = { leak: true } }',
    '            }',
    '            if (facts && facts.leak === true) {',
    '              practiceGate.scoreBucket = \'leak\'',
    '              return',
    '            }',
    '            if (facts && facts.savedReceipt === true) {',
    '              if (!practiceGate.attemptSha256) {',
    '                practiceGate.attemptSha256 = facts.attemptSha256',
    '                practiceGate.scoreBucket = facts.scoreBucket',
    '              } else if (!practiceGate.replaySha256) {',
    '                practiceGate.replaySha256 = facts.attemptSha256',
    '              }',
    '            }',
    '          })())',
    '          return',
    '        }',
    '        if (!practiceKind) return',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '      if (!questionVisible) {',
    '        outcome = finish(\'FAILED\', shown && shown.entry !== \'reading\' ? \'entry-marker-missing\' : \'ui-not-question\')',
    '        return outcome',
    '      }',
    '      if (practiceGate.legacy !== 0 || traffic.some((row) => row.reason === \'attempt-write-closed\' || row.reason === \'checkpoint-write-closed\' || row.reason === \'score-write-closed\' || row.reason === \'learning-write-closed\')) {',
    '        outcome = finish(\'FAILED\', practiceGate.legacy !== 0 ? \'legacy-create-attempted\' : \'session-write-attempted\')',
    '        return outcome',
    '      }',
    '      outcome = finish(\'OBSERVED\', \'published-practice\', \'article-88061\', \'opened\')',
    '      return outcome',
  ].join('\n'), [
    '      if (!questionVisible) {',
    '        outcome = finish(\'FAILED\', shown && shown.entry !== \'reading\' ? \'entry-marker-missing\' : \'ui-not-question\')',
    '        return outcome',
    '      }',
    '      if (practiceGate.legacy !== 0 || traffic.some((row) => row.reason === \'checkpoint-write-closed\' || row.reason === \'score-write-closed\' || row.reason === \'learning-write-closed\')) {',
    '        outcome = finish(\'FAILED\', practiceGate.legacy !== 0 ? \'legacy-create-attempted\' : \'session-write-attempted\')',
    '        return outcome',
    '      }',
    '      const clicked = await clickVisibleChoice(page)',
    '      if (clicked !== \'clicked\') {',
    '        outcome = finish(\'FAILED\', clicked === \'second-submit-present\' ? \'second-submit-present\' : \'choice-not-clicked\')',
    '        return outcome',
    '      }',
    '      ui.choice = { gesture: \'click\', gestureCount: 1 }',
    '      const attemptBound = Math.min(deadline, Date.now() + 15000)',
    '      while (Date.now() < attemptBound && practiceGate.attemptContinued !== 1) {',
    '        if (traffic.some((row) => row.disposition === \'abort\' && typeof row.reason === \'string\' && row.reason.startsWith(\'attempt-\'))) break',
    '        await new Promise((resolve) => setTimeout(resolve, 100))',
    '      }',
    '      await settlePractice()',
    '      const attemptRow = traffic.find((row) => row.type === \'attempt-post\' && row.disposition === \'continue\')',
    '      if (!attemptRow || attemptRow.status !== 200 || practiceGate.attemptContinued !== 1 || !practiceGate.attemptSha256 || practiceGate.scoreBucket === \'leak\') {',
    '        const abortedAttempt = traffic.find((row) => row.disposition === \'abort\' && (row.reason === \'attempt-body-rejected\' || row.reason === \'attempt-key-rejected\'))',
    '        const failReason = practiceGate.scoreBucket === \'leak\' ? \'attempt-leak\' : (abortedAttempt && typeof abortedAttempt.reason === \'string\' ? abortedAttempt.reason : \'attempt-not-one\')',
    '        outcome = finish(\'FAILED\', failReason)',
    '        if (outcome) outcome.attemptProbe = safeAttemptProbe(traffic)',
    '        return outcome',
    '      }',
    '      const feedback = await readFeedback(page, deadline)',
    '      ui.feedback = {',
    '        saved: Boolean(feedback && feedback.saved === true),',
    '        visible: Boolean(feedback && feedback.saveVisible === true && feedback.feedbackVisible === true && feedback.feedbackPresent === true),',
    '      }',
    '      if (!ui.feedback.saved || !ui.feedback.visible) {',
    '        outcome = finish(\'FAILED\', \'feedback-not-rendered\', \'article-88061\', \'opened\')',
    '        return outcome',
    '      }',
    '      if (Date.now() > deadline) {',
    '        outcome = finish(\'FAILED\', \'deadline\')',
    '        return outcome',
    '      }',
    '      try {',
    '        const replayed = await page.evaluate(async (spec) => {',
    '          const res = await fetch(spec.url, {',
    '            method: \'POST\',',
    '            headers: {',
    '              Authorization: spec.authorization,',
    '              Origin: spec.origin,',
    '              \'Content-Type\': spec.contentType,',
    '              \'Idempotency-Key\': spec.idempotency,',
    '              Accept: \'application/json\',',
    '            },',
    '            body: spec.body,',
    '          })',
    '          return { status: res.status }',
    '        }, {',
    '          url: practiceGate.attemptUrl,',
    '          authorization: practiceGate.attemptAuth,',
    '          origin: practiceGate.attemptOrigin,',
    '          contentType: practiceGate.attemptType,',
    '          idempotency: practiceGate.attemptKey,',
    '          body: practiceGate.attemptBody,',
    '        })',
    '        if (!replayed || replayed.status !== 200) {',
    '          outcome = finish(\'FAILED\', \'replay-not-200\')',
    '          return outcome',
    '        }',
    '      } catch {',
    '        outcome = finish(\'FAILED\', \'replay-not-sent\')',
    '        return outcome',
    '      }',
    '      const replayBound = Math.min(deadline, Date.now() + 8000)',
    '      while (Date.now() < replayBound && practiceGate.attemptReplayContinued !== 1) {',
    '        await new Promise((resolve) => setTimeout(resolve, 100))',
    '      }',
    '      await settlePractice()',
    '      const replayRow = traffic.find((row) => row.type === \'attempt-replay\' && row.disposition === \'continue\')',
    '      if (!replayRow || replayRow.status !== 200 || practiceGate.attemptReplayContinued !== 1) {',
    '        outcome = finish(\'FAILED\', \'replay-not-one\')',
    '        return outcome',
    '      }',
    '      if (!practiceGate.replaySha256 || practiceGate.replaySha256 !== practiceGate.attemptSha256) {',
    '        outcome = finish(\'FAILED\', \'replay-attempt-mismatch\')',
    '        return outcome',
    '      }',
    '      if (traffic.filter((row) => row.type === \'attempt-post\' && row.disposition === \'continue\').length !== 1) {',
    '        outcome = finish(\'FAILED\', \'attempt-not-one\')',
    '        if (outcome) outcome.attemptProbe = safeAttemptProbe(traffic)',
    '        return outcome',
    '      }',
    '      if (traffic.filter((row) => row.type === \'attempt-replay\' && row.disposition === \'continue\').length !== 1) {',
    '        outcome = finish(\'FAILED\', \'replay-not-one\')',
    '        return outcome',
    '      }',
    '      if (practiceGate.legacy !== 0 || traffic.some((row) => row.reason === \'attempt-write-closed\' || row.reason === \'checkpoint-write-closed\' || row.reason === \'score-write-closed\' || row.reason === \'learning-write-closed\')) {',
    '        outcome = finish(\'FAILED\', practiceGate.legacy !== 0 ? \'legacy-create-attempted\' : \'session-write-attempted\')',
    '        return outcome',
    '      }',
    '      outcome = finish(\'OBSERVED\', \'published-practice-scored\', \'article-88061\', \'opened\')',
    '      return outcome',
  ].join('\n'))
  if (next == null) return null
  next = once(next, [
    '    practiceGate.sessionId = \'\'',
    '    practiceGate.sessionSha256 = null',
    '    practiceGate.getPathSha = null',
    '    practiceGate.questionSha256 = null',
  ].join('\n'), [
    '    practiceGate.sessionId = \'\'',
    '    practiceGate.sessionSha256 = null',
    '    practiceGate.getPathSha = null',
    '    practiceGate.questionSha256 = null',
    '    practiceGate.attemptKey = \'\'',
    '    practiceGate.attemptBody = \'\'',
    '    practiceGate.attemptUrl = \'\'',
    '    practiceGate.attemptAuth = \'\'',
    '    practiceGate.attemptOrigin = \'\'',
    '    practiceGate.attemptType = \'\'',
    '    practiceGate.attemptSha256 = null',
    '    practiceGate.replaySha256 = null',
  ].join('\n'))
  if (next == null) return null
  const sessionAt = next.indexOf('const SESSION_LEAKS = [')
  const sessionEnd = next.indexOf('\n]', sessionAt)
  if (sessionAt < 0 || sessionEnd < 0 || next.slice(sessionAt, sessionEnd).includes('Owner stem')) return null
  if (next.split('Owner stem').length !== 4) return null
  if (!next.includes('\'Owner stem\', \'Owned  sentence\', \'Owned gloss\', \'Read this short line.\'')) return null
  if (!next.includes('\'readingRuleSeal\', \'Owner stem\', \'Read this short line.\', \'"beta"\'')) return null
  if (!next.includes('function answerMaterial(value) {')) return null
  if (!next.includes('const ANSWER_KEY = /^(correctoptions?|acceptedkeys|correctkey|answerkeys?|answerrule|ruledigest)$/i')) return null
  if (!next.includes('pin.contentCode !== CONTENT_CODE || pin.pinStatus !== \'PINNED\' || pin.contentVersionId !== version')) return null
  if (!next.includes('post.questionSha256 === got.questionSha256 && ui.practice.promptExact === true && ui.practice.optionsExact === true')) return null
  if (!next.includes('posts[0].sessionSha256 !== gets[0].sessionSha256 || posts[0].sessionSha256 !== practiceGate.getPathSha')) return null
  if (!next.includes('posts[0].questionSha256 !== gets[0].questionSha256')) return null
  if (next.includes('button.reading-cta')) return null
  if (!next.includes('settleLiveDetailCta') || !next.includes('.reading-cta[data-action="published-practice"]')) return null
  if (!next.includes('published-practice-scored')) return null
  if (!next.includes('data-save-receipt') || !next.includes('data-feedback-text')) return null
  if (!next.includes('.b10-exercise-card .b10-option')) return null
  if (!next.includes('attempt-post') || !next.includes('attempt-replay')) return null
  if (!next.includes('function attemptBodyVerdict(raw)')) return null
  if (!next.includes('function safeAttemptProbe(traffic)')) return null
  if (!next.includes('selectedOptionKeys')) return null
  if (!next.includes('/^[a-z][a-z0-9._:-]{0,63}$/')) return null
  if (!next.includes('outcome.attemptProbe = safeAttemptProbe(traffic)')) return null
  if (!next.includes('host: url.hostname')) return null
  if (next.includes("FORBIDDEN_SNIPPETS.some((snippet) => raw.includes(snippet))) return 'rejected'")) return null
  if (!next.includes("FORBIDDEN_SNIPPETS.some((snippet) => raw.includes(snippet))) return { leak: true }")) return null
  if (next.includes("page.locator('.v2-b2p-submit')") || next.includes("page.locator('.b10-submit')")) return null
  if (next.includes('practice.submit') || next.includes('提交答案')) return null
  return next
}

if (!pinBytes(G360_WRAPPER, G360_WRAPPER_SHA) || !pinBytes(G399_SNAPSHOT, G399_SNAPSHOT_SHA)) failClosed()
const source = loadFrozen()
const patched = source ? patch(source) : null
if (!patched) failClosed()
const compiled = new Module(module.filename, module.parent)
compiled.filename = module.filename
compiled.paths = module.paths
try {
  compiled._compile(patched, module.filename)
} catch {
  failClosed()
}
