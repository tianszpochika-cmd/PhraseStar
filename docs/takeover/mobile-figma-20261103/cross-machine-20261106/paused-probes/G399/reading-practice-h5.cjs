'use strict'
/**
 * G338 published-practice observer entry.
 *
 * Node runs this file only. It checks the pinned G280 observer bytes, applies
 * the unchanged G325 uni-button CTA seam, then removes only the literal
 * learner stem from SESSION_LEAKS. Article leaks, OUTPUT_LEAKS, and the raw
 * answer-key checks stay. The G280 selectors stay unexecuted. No class or
 * attribute is written into the page. No service, browser, or port is started
 * by loading this file until the patched observer reaches its own main.
 */
const fs = require('node:fs')
const crypto = require('node:crypto')
const Module = require('node:module')

const FROZEN = '/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs'
const FROZEN_SHA = '679db31207ef097a117170a88b1ba2d305f0755b7f2ddc38f5c070be91573137'

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
  return next
}

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
