'use strict'
/**
 * Offline cases for the G455 attempt response classifier.
 * No browser, Gateway, or product source. Exercises the same rules the
 * observer injects: pending key pairing, fail-reason mapping, sanitized
 * failure class, body shape, and error-code shape.
 */
function sanitizeFailure(failure) {
  const raw = failure && typeof failure.errorText === 'string' ? failure.errorText : ''
  if (/TIMEOUT|TIMED_OUT|TIMED OUT|TIMED-OUT/i.test(raw)) return 'timeout'
  if (/ABORT|ERR_ABORTED|NS_BINDING_ABORTED/i.test(raw)) return 'aborted'
  if (/REFUSED|RESET|CONNECTION|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED/i.test(raw)) return 'connection'
  if (/net::ERR_/.test(raw)) return 'net-error'
  return raw ? 'other' : 'unknown'
}

function bodyShape(contentType, raw) {
  if (typeof raw !== 'string' || raw.length === 0) return 'empty'
  const ct = typeof contentType === 'string' ? contentType.toLowerCase() : ''
  if (ct.includes('text/html') || /^\s*</.test(raw)) return 'html'
  if (ct.includes('json') || raw.charAt(0) === '{' || raw.charAt(0) === '[') return 'json'
  return 'other'
}

function sanitizedErrorCode(parsed) {
  const nested = parsed && parsed.error && typeof parsed.error === 'object' ? parsed.error.code : null
  const code = parsed && (parsed.errorCode || parsed.code || nested)
  if (typeof code !== 'string' || code.length < 1 || code.length > 40) return null
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,39}$/.test(code)) return null
  return code
}

function failAttemptReason(spec) {
  if (spec.scoreBucket === 'leak') return 'attempt-leak'
  if (spec.abortReason === 'attempt-body-rejected' || spec.abortReason === 'attempt-key-rejected') return spec.abortReason
  if (spec.requestFailed === true) return 'attempt-request-failed'
  if (Number.isInteger(spec.status) && spec.status !== 200) return 'attempt-not-200'
  if (spec.continued === 1 && !Number.isInteger(spec.status)) return 'attempt-response-missing'
  return 'attempt-not-one'
}

function pendingKey(method, url) {
  return `${method} ${new URL(url).pathname}`
}

function matchPending(requestUrl, responseUrl, method) {
  const requestKey = pendingKey(method, requestUrl)
  const responseKey = pendingKey(method, responseUrl)
  const requestPath = new URL(requestUrl).pathname
  return {
    requestKey,
    responseKey,
    samePath: requestPath === new URL(responseUrl).pathname,
    pairByRequest: requestKey === `${method} ${requestPath}`,
  }
}

const cases = [
  {
    name: 'g446-receipt-maps-to-response-missing',
    got: failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: false, status: null, continued: 1 }),
    want: 'attempt-response-missing',
  },
  {
    name: 'requestfailed-before-status',
    got: failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: true, status: null, continued: 1 }),
    want: 'attempt-request-failed',
  },
  {
    name: 'http-500-not-success',
    got: failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: false, status: 500, continued: 1 }),
    want: 'attempt-not-200',
  },
  {
    name: 'http-409-not-success',
    got: failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: false, status: 409, continued: 1 }),
    want: 'attempt-not-200',
  },
  {
    name: 'leak-still-leak',
    got: failAttemptReason({ scoreBucket: 'leak', abortReason: null, requestFailed: false, status: 200, continued: 1 }),
    want: 'attempt-leak',
  },
  {
    name: 'body-rejected-still-body',
    got: failAttemptReason({ scoreBucket: null, abortReason: 'attempt-body-rejected', requestFailed: false, status: null, continued: 0 }),
    want: 'attempt-body-rejected',
  },
  {
    name: 'no-post-still-not-one',
    got: failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: false, status: null, continued: 0 }),
    want: 'attempt-not-one',
  },
  {
    name: 'sanitize-timeout',
    got: sanitizeFailure({ errorText: 'net::ERR_TIMED_OUT' }),
    want: 'timeout',
  },
  {
    name: 'sanitize-timeout-space',
    got: sanitizeFailure({ errorText: 'net::ERR_TIMED OUT' }),
    want: 'timeout',
  },
  {
    name: 'sanitize-timeout-hyphen',
    got: sanitizeFailure({ errorText: 'net::ERR_TIMED-OUT' }),
    want: 'timeout',
  },
  {
    name: 'sanitize-net-error-fallback',
    got: sanitizeFailure({ errorText: 'net::ERR_FAILED' }),
    want: 'net-error',
  },
  {
    name: 'sanitize-aborted',
    got: sanitizeFailure({ errorText: 'net::ERR_ABORTED' }),
    want: 'aborted',
  },
  {
    name: 'sanitize-connection',
    got: sanitizeFailure({ errorText: 'net::ERR_CONNECTION_REFUSED' }),
    want: 'connection',
  },
  {
    name: 'sanitize-empty',
    got: sanitizeFailure(null),
    want: 'unknown',
  },
  {
    name: 'body-json',
    got: bodyShape('application/json', '{"data":{}}'),
    want: 'json',
  },
  {
    name: 'body-html-not-stored',
    got: bodyShape('text/html; charset=utf-8', '<html>secret</html>'),
    want: 'html',
  },
  {
    name: 'body-empty',
    got: bodyShape('application/json', ''),
    want: 'empty',
  },
  {
    name: 'error-code-ok',
    got: sanitizedErrorCode({ error: { code: 'ASSESSMENT_CONFLICT' } }),
    want: 'ASSESSMENT_CONFLICT',
  },
  {
    name: 'error-code-rejects-html',
    got: sanitizedErrorCode({ code: '<script>x</script>' }),
    want: null,
  },
  {
    name: 'error-code-rejects-long',
    got: sanitizedErrorCode({ code: `E${'x'.repeat(80)}` }),
    want: null,
  },
]

const attemptUrl = 'http://127.0.0.1:18070/api/v1/assessment/sessions/asess_0123456789abcdef0123456789abcdef/attempts'
const redirectUrl = 'http://127.0.0.1:18070/api/v1/assessment/sessions/asess_0123456789abcdef0123456789abcdef/attempts/'
const pairSame = matchPending(attemptUrl, attemptUrl, 'POST')
const pairRedirect = matchPending(attemptUrl, redirectUrl, 'POST')
cases.push({
  name: 'pending-key-uses-request-path',
  got: pairSame.requestKey,
  want: 'POST /api/v1/assessment/sessions/asess_0123456789abcdef0123456789abcdef/attempts',
})
cases.push({
  name: 'response-url-slash-diverges',
  got: pairRedirect.samePath,
  want: false,
})
cases.push({
  name: 'pair-by-request-still-true-when-response-diverges',
  got: pairRedirect.pairByRequest,
  want: true,
})
cases.push({
  name: 'success-oracle-still-requires-200',
  got: failAttemptReason({ scoreBucket: 'FULL', abortReason: null, requestFailed: false, status: 200, continued: 1 }) === 'attempt-not-one'
    && failAttemptReason({ scoreBucket: null, abortReason: null, requestFailed: false, status: 200, continued: 1 }) === 'attempt-not-one',
  want: true,
})

const failed = cases.filter((item) => Object.is(item.got, item.want) === false)
const report = {
  ok: failed.length === 0,
  passed: cases.length - failed.length,
  total: cases.length,
  failed: failed.map((item) => ({ name: item.name, got: item.got, want: item.want })),
}
process.stdout.write(`${JSON.stringify(report)}\n`)
process.exit(failed.length === 0 ? 0 : 1)
