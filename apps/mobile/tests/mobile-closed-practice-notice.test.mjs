import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

const appRoot = path.resolve(import.meta.dirname, '..')
const componentPath = 'src/components/MobileClosedPracticeNotice.vue'
const req = createRequire(path.join(appRoot, 'package.json'))
const { parse, compileScript, compileTemplate } = req('@vue/compiler-sfc')
const ts = req('typescript')
const vue = req('@vue/runtime-core')

function mountNotice(props) {
  const filename = path.join(appRoot, componentPath)
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw errors[0]
  const id = 'closed-notice-test'
  const script = compileScript(descriptor, { id })
  const scriptCode = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const scriptModule = { exports: {} }
  new Function('require', 'module', 'exports', scriptCode)((name) => {
    if (name === 'vue') return vue
    if (name === '../platform/experience') return { mobileT: (key) => `mobile.${key}` }
    throw new Error(`Unexpected component import ${name}`)
  }, scriptModule, scriptModule.exports)
  const component = scriptModule.exports.default

  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id,
    compilerOptions: { isCustomElement: () => true, bindingMetadata: script.bindings },
  })
  if (template.errors.length) throw template.errors[0]
  const templateCode = ts.transpileModule(template.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const templateModule = { exports: {} }
  new Function('require', 'module', 'exports', templateCode)((name) => {
    if (name === 'vue') return vue
    throw new Error(`Unexpected template import ${name}`)
  }, templateModule, templateModule.exports)
  component.render = templateModule.exports.render

  const operations = {
    createElement(type) { return { type, props: {}, children: [], parent: null } },
    createText(text) { return { type: '#text', text, props: {}, children: [], parent: null } },
    createComment(text) { return { type: '#comment', text, props: {}, children: [], parent: null } },
    insert(child, parent, anchor = null) {
      child.parent = parent
      if (anchor && parent.children.includes(anchor)) parent.children.splice(parent.children.indexOf(anchor), 0, child)
      else parent.children.push(child)
    },
    remove(child) {
      if (!child.parent) return
      const index = child.parent.children.indexOf(child)
      if (index >= 0) child.parent.children.splice(index, 1)
      child.parent = null
    },
    setElementText(node, text) { node.text = text },
    setText(node, text) { node.text = text },
    parentNode(node) { return node.parent ?? null },
    nextSibling(node) {
      if (!node.parent) return null
      return node.parent.children[node.parent.children.indexOf(node) + 1] ?? null
    },
    patchProp(element, key, _previous, next) { element.props[key] = next },
    querySelector() { return null },
    setScopeId() {},
    cloneNode(node) { return { ...node, props: { ...node.props }, children: [] } },
    insertStaticContent(content, parent, anchor) {
      const node = operations.createElement('static')
      node.text = content
      operations.insert(node, parent, anchor)
      return [node, node]
    },
  }
  const renderer = vue.createRenderer(operations)
  const calls = { back: 0, select: [] }
  const root = operations.createElement('root')
  const app = renderer.createApp({
    render() {
      return vue.h(component, {
        ...props,
        onBack: () => { calls.back += 1 },
        onSelect: (target) => { calls.select.push(target) },
      }, { queue: () => vue.h('view', { class: 'queue-slot' }, 'queue-content') })
    },
  })
  app.mount(root)
  return { root, calls, app }
}

function collect(node, predicate, out = []) {
  if (predicate(node)) out.push(node)
  for (const child of node.children ?? []) collect(child, predicate, out)
  return out
}

function texts(node, out = []) {
  if (typeof node.text === 'string') out.push(node.text)
  for (const child of node.children ?? []) texts(child, out)
  return out
}

const props = {
  variant: 'offline',
  pageTitleKey: 'closed.offline.title',
  pageSubtitleKey: 'closed.offline.subtitle',
  titleKey: 'closed.offline.cardTitle',
  descriptionKey: 'closed.offline.reason',
  ariaLabelKey: 'closed.offline.cardTitle',
  glowSrc: '/static/figma-closed-169-8610/c6ebc160-a569-4d54-8b8e-1e8d8c24e667.svg',
  iconSrc: '/static/figma-closed-169-8610/39d39cfd-9d9f-4a74-87dd-7d2afa230999.svg',
  alternatives: [
    {
      id: 'vocab',
      target: '/pages/b2-vocabulary/b2-vocabulary',
      iconSrc: '/static/figma-closed-169-8610/39d39cfd-9d9f-4a74-87dd-7d2afa230999.svg',
      chevronSrc: '/static/figma-closed-169-8610/7edc101f-d5d5-4cb8-a983-636b09d16b77.svg',
      titleKey: 'closed.alternatives.vocab',
      metaKey: 'closed.alternatives.vocabMeta',
      tone: 'brand',
    },
    {
      id: 'reading',
      target: '/pages/b3-reading/b3-reading',
      iconSrc: '/static/figma-closed-169-8610/7edc101f-d5d5-4cb8-a983-636b09d16b77.svg',
      chevronSrc: '/static/figma-closed-169-8610/7edc101f-d5d5-4cb8-a983-636b09d16b77.svg',
      titleKey: 'closed.alternatives.reading',
      metaKey: 'closed.alternatives.readingMeta',
      tone: 'ok',
    },
  ],
}

test('closed notice mounts as one data-closed-practice root with queue slot and mobileT keys', () => {
  const { root, app } = mountNotice(props)
  assert.equal(root.children.length, 1)
  const notice = root.children[0]
  assert.equal(notice.type, 'view')
  assert.ok(Object.hasOwn(notice.props, 'data-closed-practice'))
  assert.equal(notice.props.role, 'region')
  assert.equal(notice.props['aria-label'], 'mobile.closed.offline.cardTitle')
  assert.match(String(notice.props.class), /v2-closed-notice--offline/u)

  const renderedTexts = texts(root)
  assert.ok(renderedTexts.includes('mobile.closed.offline.title'))
  assert.ok(renderedTexts.includes('mobile.closed.offline.subtitle'))
  assert.ok(renderedTexts.includes('mobile.closed.offline.cardTitle'))
  assert.ok(renderedTexts.includes('mobile.closed.offline.reason'))
  assert.ok(renderedTexts.includes('mobile.closed.comingSoon'))
  assert.ok(renderedTexts.includes('mobile.closed.alternatives.title'))
  assert.ok(renderedTexts.includes('mobile.closed.alternatives.vocab'))
  assert.ok(renderedTexts.includes('mobile.closed.alternatives.reading'))
  assert.ok(renderedTexts.includes('queue-content'))
  assert.ok(renderedTexts.every((text) => !text.startsWith('mobile.mobile.')))

  const images = collect(root, (node) => node.type === 'image').map((node) => node.props.src)
  assert.ok(images.includes(props.glowSrc))
  assert.ok(images.includes(props.iconSrc))
  assert.ok(images.includes(props.alternatives[0].iconSrc))
  assert.ok(images.includes(props.alternatives[1].iconSrc))
  assert.ok(images.includes(props.alternatives[0].chevronSrc))

  const badge = collect(root, (node) => Object.hasOwn(node.props ?? {}, 'data-coming-soon'))
  const reason = collect(root, (node) => Object.hasOwn(node.props ?? {}, 'data-closed-reason'))
  assert.equal(badge.length, 1)
  assert.equal(reason.length, 1)
  app.unmount()
})

test('closed notice emits select targets for alternatives and back for the CTA', () => {
  const { root, calls, app } = mountNotice(props)
  const buttons = collect(root, (node) => node.type === 'button')
  assert.equal(buttons.length, 3)
  buttons[0].props.onClick()
  buttons[1].props.onClick()
  buttons[2].props.onClick()
  assert.deepEqual(calls.select, ['/pages/b2-vocabulary/b2-vocabulary', '/pages/b3-reading/b3-reading'])
  assert.equal(calls.back, 1)
  app.unmount()
})

test('closed notice stays pure UI and preserves the single-root sibling-hide contract', async () => {
  const source = fs.readFileSync(path.join(appRoot, componentPath), 'utf8')
  const appSource = fs.readFileSync(path.join(appRoot, 'src/App.vue'), 'utf8')
  assert.match(appSource, /\[data-closed-practice\] ~ \*\{display:none !important\}/u)
  assert.match(source, /data-closed-practice/u)
  assert.match(source, /<slot name="queue" \/>/u)
  assert.match(source, /emit\('select', item\.target\)/u)
  assert.match(source, /emit\('back'\)/u)
  assert.match(source, /mobileT\('closed\./u)
  assert.doesNotMatch(source, /mobileT\('mobile\./u)
  assert.doesNotMatch(source, /getUniRuntime|useB4Store|useB11LearningStore|useSessionStore|from '.*api\//u)
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(source, /rgba?\(/u)
  assert.match(source, /--closed-art-offline-from/u)
  assert.match(source, /--closed-art-writing-from/u)
  assert.match(source, /--closed-art-listening-from/u)
  assert.match(source, /--closed-art-speaking-from/u)
})
