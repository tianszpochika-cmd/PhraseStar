import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const pages = [
  ['src/pages/b4-offline/b4-offline.vue', '/static/figma-closed-169-8610/7edc101f-d5d5-4cb8-a983-636b09d16b77.svg'],
  ['src/pages/b3-writing/b3-writing.vue', '/static/figma-closed-168-6945/c2887965-483d-4879-8090-ebece5c7c6a6.svg'],
  ['src/pages/b3-listening/b3-listening.vue', '/static/figma-closed-168-3746/59736468-29fc-451d-b095-809594a1ff91.svg'],
  ['src/pages/b11-listening/b11-listening.vue', '/static/figma-closed-168-4327/3a7b6e37-d5f6-4494-8b21-2e493d4581ab.svg'],
  ['src/pages/b3-speaking/b3-speaking.vue', '/static/figma-closed-168-5501/9e998881-5cf4-47d5-a4b3-8b77c7bb8347.svg'],
  ['src/pages/b11-speaking/b11-speaking.vue', '/static/figma-closed-168-6160/571548d9-e968-4aee-9c47-f0d8151ae53e.svg'],
  ['src/pages/b4-games/b4-games.vue', '/static/figma-games-catalog-169-5353/73e64094-9ca5-43cf-bfb9-5229b88801de.svg'],
  ['src/pages/b4-social/b4-social.vue', '/static/figma-social-rooms-169-6882/14ab6b99-f06b-4dae-b2ca-46361c7db5e3.svg'],
]

function svgSize(file) {
  const source = fs.readFileSync(path.join(appRoot, 'src', file.replace(/^\/static\//, 'static/')), 'utf8')
  const width = source.match(/width="([\d.]+)"/)?.[1]
  const height = source.match(/height="([\d.]+)"/)?.[1]
  return [Number(width), Number(height)]
}

test('all eight owned pages use the released centered header with local chevL and no settings gear', () => {
  for (const [file, chev] of pages) {
    const source = fs.readFileSync(path.join(appRoot, file), 'utf8')
    const header = source.match(/<MobilePageHeader[^>]*\/>/)?.[0] ?? ''
    assert.match(header, /compact/u, `${file}: compact missing`)
    assert.ok(header.includes(`back-icon-src="${chev}"`), `${file}: local chevL missing`)
    assert.match(header, /:show-settings="false"/u, `${file}: settings still visible`)
    assert.match(header, /:title="mobileT\('/u, `${file}: title not from mobileT`)
    const asset = path.join(appRoot, 'src', chev.replace(/^\/static\//, 'static/'))
    assert.ok(fs.existsSync(asset), `${file}: chevL asset missing`)
    assert.deepEqual(svgSize(chev), [22, 22], `${file}: chevL root must stay 22x22`)
  }
})

test('closed notice keeps the reference glow wrapper and intrinsic SVG assets without stretching', () => {
  const source = fs.readFileSync(path.join(appRoot, 'src/components/MobileClosedPracticeNotice.vue'), 'utf8')
  assert.match(source, /\.v2-closed-notice__glow\{[^}]*width:360px;height:300px/u)
  assert.match(source, /\.v2-closed-notice__glow-img\{[^}]*width:540px;height:480px/u)
  assert.match(source, /\.v2-closed-notice__chev\{[^}]*width:20px;height:20px/u)
  assert.deepEqual(svgSize('/static/figma-closed-169-8610/c6ebc160-a569-4d54-8b8e-1e8d8c24e667.svg'), [540, 480])
  assert.deepEqual(svgSize('/static/figma-closed-168-6945/3c5187e8-0de1-47b7-a99f-096226453a9f.svg'), [20, 20])
})
