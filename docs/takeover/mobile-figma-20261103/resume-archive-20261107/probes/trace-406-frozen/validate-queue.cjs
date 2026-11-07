#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const DIR = '/tmp/grok-mobile-resume-trace-406'
const QUEUE = path.join(DIR, 'queue.json')
const PINS = path.join(DIR, 'pins.json')
const EXPECTED_HEAD = '61b9ede7c65ef065c76c846c27fb69a52cd042cd'
const SECRET = /(password|passwd|secret|token|authorization|cookie)=/i

function fail(message) {
  process.stderr.write(message + '\n')
  process.exit(1)
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8')
  if (SECRET.test(raw)) fail('secret-like pattern in ' + file)
  return JSON.parse(raw)
}

const queue = readJson(QUEUE)
const pins = readJson(PINS)

if (queue.sourceHead !== EXPECTED_HEAD) fail('queue sourceHead mismatch')
if (pins.sourceHead !== EXPECTED_HEAD) fail('pins sourceHead mismatch')
if (queue.trace !== 'TRACE_PENDING') fail('trace must stay TRACE_PENDING')
if (queue.signoff !== 'PENDING') fail('signoff must stay PENDING')
if (queue.dod !== 'not_run') fail('dod must stay not_run')
if (queue.formalRouteSignoffs !== 0) fail('formalRouteSignoffs must stay 0')
if (queue.runtime !== 'NOT_RUN') fail('runtime must stay NOT_RUN')
if (!Array.isArray(queue.routes) || queue.routes.length !== 33) fail('need 33 routes')

const ids = queue.routes.map((row) => row.id)
for (let i = 1; i <= 33; i += 1) {
  const id = 'MB-' + String(i).padStart(3, '0')
  if (ids[i - 1] !== id) fail('route order ' + id)
  const row = queue.routes[i - 1]
  if (row.trace !== 'TRACE_PENDING') fail(id + ' trace')
  if (row.dod !== 'not_run') fail(id + ' dod')
  if (typeof row.currentCapability !== 'string' || !row.currentCapability) fail(id + ' capability')
  if (typeof row.nextTest !== 'string' || !row.nextTest) fail(id + ' nextTest')
  if (typeof row.closeableViaCurrentServiceNormalEntry !== 'boolean') fail(id + ' closeable flag')
  if (!row.requirementIds || !Array.isArray(row.requirementIds.exactAnchors)) fail(id + ' exactAnchors')
}

if (queue.distinctPriorityQueue.length < 10) fail('priority queue too short')
if (queue.closeableLocalGates.length < 8) fail('closeable gates too short')

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      routes: queue.routes.length,
      closeable: queue.routes.filter((row) => row.closeableViaCurrentServiceNormalEntry).length,
      assigned: queue.routes.filter((row) => row.assignedJob).map((row) => row.id + ':' + row.assignedJob),
      signoff: queue.signoff,
      runtime: queue.runtime,
      sourceHead: queue.sourceHead
    },
    null,
    2
  ) + '\n'
)
