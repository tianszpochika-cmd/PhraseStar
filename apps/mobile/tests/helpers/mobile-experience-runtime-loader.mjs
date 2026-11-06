import { createRequire } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const helperDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(helperDir, '../..')
const repoRoot = path.resolve(mobileRoot, '../..')
const require = createRequire(path.join(mobileRoot, 'package.json'))
const ts = require('typescript')

function cleanFileUrl(url) {
  return url.split('?')[0].split('#')[0]
}

function insideCheckout(filePath) {
  const relative = path.relative(repoRoot, path.resolve(filePath))
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return false
  return !relative.split(path.sep).includes('node_modules')
}

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && parent?.startsWith('file:')) {
    const parentPath = fileURLToPath(cleanFileUrl(parent))
    if (insideCheckout(parentPath)) {
      const target = new URL(specifier, cleanFileUrl(parent))
      const pathname = fileURLToPath(target)
      const candidates = [pathname, `${pathname}.ts`, `${pathname}.mjs`, `${pathname}.js`]
      for (const candidate of candidates) {
        if (insideCheckout(candidate) && existsSync(candidate) && statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  const clean = cleanFileUrl(url)
  if (!clean.startsWith('file:') || !clean.endsWith('.ts')) return nextLoad(url, context)
  const filename = fileURLToPath(clean)
  if (!insideCheckout(filename)) return nextLoad(url, context)
  const result = ts.transpileModule(await readFile(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    throw new SyntaxError(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'))
  }
  return { format: 'module', source: result.outputText, shortCircuit: true }
}
