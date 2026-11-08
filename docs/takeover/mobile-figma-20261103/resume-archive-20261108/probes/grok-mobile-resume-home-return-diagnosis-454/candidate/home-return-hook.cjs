'use strict'

/**
 * Preload for the G372/B96 in-process browser module. After runTargetBrowser
 * returns the full placement+ensure receipt, this hook runs the 454 home-return
 * observer with the same in-memory credentials. Direct execution prints usage.
 */

const Module = require('node:module')
const path = require('node:path')
const observer = require(path.join(__dirname, 'home-return-observer.cjs'))

const USAGE = [
  'home-return-hook.cjs is a NODE_OPTIONS preload.',
  'The 454 wrapper sets NODE_OPTIONS=--require this file and MB454_HOME_RETURN=YES_ONE_FRESH_ACTOR_HOME_RETURN.',
  'It wraps runTargetBrowser from browser-target-probe.cjs in the same Node process.',
  'Direct execution does not open Chrome or bind a port.',
].join('\n')

function wrap(exports) {
  if (!exports || typeof exports.runTargetBrowser !== 'function' || exports.__mb405Wrapped) return exports
  const inner = exports.runTargetBrowser.bind(exports)
  exports.runTargetBrowser = async function wrappedRunTargetBrowser(opts) {
    const first = await inner(opts)
    return observer.afterPlacementJourney(opts, first)
  }
  exports.__mb405Wrapped = true
  return exports
}

const originalLoad = Module._load
Module._load = function hookedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments)
  const name = typeof request === 'string' ? request : ''
  if (name.endsWith('browser-target-probe.cjs') || name === './browser-target-probe.cjs') {
    return wrap(loaded)
  }
  return loaded
}

if (require.main === module) {
  process.stdout.write(`${USAGE}\n`)
}

module.exports = { wrap }
