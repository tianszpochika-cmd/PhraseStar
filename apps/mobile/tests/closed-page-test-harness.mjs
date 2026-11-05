import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

/**
 * Load one closed-page SFC script with explicit module stubs.
 * This executes the real page script, so tests cover guards and route helpers,
 * not just the CSS/template text.
 */
export function loadClosedPage(relativePath, options = {}) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/u)?.[1]
  if (!script) throw new Error(`Missing script setup in ${relativePath}`)
  const template = source.match(/<template>([\s\S]*?)<\/template>/u)?.[1] ?? ''

  const calls = {
    navigate: [],
    ensure: [],
    api: [],
    sessionRestore: 0,
    audioContexts: 0,
    b4Restore: 0,
    b4LoadWorld: 0,
    b4Sync: 0,
    store: [],
    storeMessages: [],
    permissions: 0,
  }
  const session = {
    isAuthenticated: options.authenticated !== false,
    verifiedSubject: options.verifiedSubject ?? 'subject-1',
    identityRevision: 1,
    async restore() { calls.sessionRestore += 1 },
    ...(options.session ?? {}),
  }
  const runtime = {
    navigateTo(optionsToCall) { calls.navigate.push(optionsToCall.url) },
    createInnerAudioContext() {
      calls.audioContexts += 1
      return { src: '', playbackRate: 1, play() {}, pause() {}, destroy() {} }
    },
    getRecorderManager() { return options.recorderManager },
    getStorageSync() { return null },
    setStorageSync() {},
    removeStorageSync() {},
  }
  const engine = {
    level: 'High',
    state: {},
    subscribe() { return () => {} },
    setLevel(level) { engine.level = level },
    restore() {},
    dispose() {},
  }
  function api(name, result) {
    return (...args) => {
      calls.api.push({ name, args })
      return Promise.resolve(typeof result === 'function' ? result(...args) : result)
    }
  }
  const b3Api = {
    listListeningMaterials: api('listListeningMaterials', []),
    createListeningSession: api('createListeningSession', null),
    submitDictation: api('submitDictation', { correct: false, score: 0, feedbackCodes: [] }),
    isB3OfflineError: () => false,
    getPhonetics: api('getPhonetics', []),
    createRecording: api('createRecording', { recordingId: 'rec-1' }),
    deleteRecording: api('deleteRecording', undefined),
    submitSelfRating: api('submitSelfRating', undefined),
    createRoleplaySession: api('createRoleplaySession', null),
    submitRoleplayTurn: api('submitRoleplayTurn', { nextTurnIndex: 0, status: 'IN_PROGRESS' }),
  }
  const b11Api = {
    loadB11ListeningMaterials: api('loadB11ListeningMaterials', []),
    authorizeB11Playback: api('authorizeB11Playback', null),
  }
  const b11Recording = {
    requestMicrophonePermission: async () => { calls.permissions += 1; return 'DENIED' },
    recorderManager: () => options.recorderManager,
    protectRecording: api('protectRecording', { localPath: '/tmp/enc', contentHash: 'a'.repeat(64), storageMode: 'KEYCHAIN' }),
    deleteProtectedRecording: api('deleteProtectedRecording', undefined),
    createRecordingPlaybackSource: api('createRecordingPlaybackSource', null),
  }
  const b10LearningApi = {
    listWritingPrompts: api('listWritingPrompts', []),
    submitWriting: api('submitWriting', {}),
    submitCorrection: api('submitCorrection', {}),
  }
  const b4 = {
    queueCount: options.queueCount ?? 0,
    offlineRecords: options.offlineRecords ?? [],
    restore() { calls.b4Restore += 1 },
    loadWorld() { calls.b4LoadWorld += 1; return Promise.resolve() },
    syncOffline() { calls.b4Sync += 1; return Promise.resolve() },
  }
  const storeTarget = {
    phonemes: [],
    languageClips: [],
    listening: null,
    listeningStatus: 'idle',
    listeningMessage: null,
    phoneticsStatus: 'idle',
    phoneticsMessage: null,
    recordingStatus: 'idle',
    recordingMessage: null,
    recordingDraft: null,
    savedRecording: null,
    permissionStatus: 'UNKNOWN',
    performanceLevel: 'High',
    motionDisabled: false,
    queueCount: 0,
    mediaRightsState: 'AUTHORIZED',
    playbackSource: null,
    mediaPositionMs: 0,
    playbackRate: 1,
    abStartMs: null,
    abEndMs: null,
    dictationAnswer: '',
    dictationResult: null,
    canUseWaveform: false,
    loadListening() { calls.store.push('loadListening'); return Promise.resolve() },
    loadPhonetics() { calls.store.push('loadPhonetics'); return Promise.resolve() },
    setRecordingMessage(message) { calls.storeMessages.push(message); storeTarget.recordingMessage = message },
    setPermissionStatus(status) { storeTarget.permissionStatus = status },
    setRecordingDraft(draft) { storeTarget.recordingDraft = draft },
    clearRecordingDraft() { storeTarget.recordingDraft = null },
    setPerformance(level) { storeTarget.performanceLevel = level },
    setMotionDisabled(disabled) { storeTarget.motionDisabled = disabled },
    setPosition(position) { storeTarget.mediaPositionMs = position },
    saveMediaProgress() { return Promise.resolve() },
    setPlaybackRate(rate) { storeTarget.playbackRate = rate },
    setABPoint(point) {},
    clearAB() {},
    selectLanguageClip(id) { storeTarget.languageClipId = id },
    syncOffline() { calls.store.push('syncOffline'); return Promise.resolve() },
    submitDictationAnswer() {},
    saveSelfRating() { return Promise.resolve() },
    completeShadowing() { return Promise.resolve() },
    registerRecordingDraft() { return Promise.resolve() },
    removeSavedRecording() {},
    ...(options.store ?? {}),
  }
  const store = new Proxy(storeTarget, {
    get(target, property) {
      if (property in target) return target[property]
      if (typeof property === 'string' && property.startsWith('__')) return undefined
      return () => undefined
    },
    set(target, property, value) { target[property] = value; return true },
  })
  const mounted = []
  const shown = []
  const unmounted = []
  const modules = {
    vue: {
      ref: (value) => ({ value }),
      computed: (getter) => ({ get value() { return getter() } }),
      onMounted: (callback) => { mounted.push(callback) },
      onUnmounted: (callback) => { unmounted.push(callback) },
      watch: () => () => {},
    },
    '@dcloudio/uni-app': { onShow: (callback) => { shown.push(callback) } },
    '@englishflow/performance': { createAdaptivePerformanceEngine: () => engine },
    '../../components/MobilePageHeader.vue': {},
    '../../components/MobileClosedPracticeNotice.vue': {},
    '../../components/AppIcon.vue': {},
    '../../components/b2/B2StatusPanel.vue': {},
    '../../components/b11/B11StatusPanel.vue': {},
    '../../components/b10/B10FeedbackCard.vue': {},
    '../../components/b10/B10StatusPanel.vue': {},
    '../../platform/experience': {
      mobileT: (key) => `mobile.${key}`,
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
    },
    '@englishflow/i18n': {
      interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? `{${key}}`)),
    },
    '../../platform/uni-runtime': {
      getUniRuntime: () => runtime,
      enableUniAudioPitchPreservation: () => {},
    },
    '../../platform/b10-foundation': {
      b10ThemeMode: { value: 'light' },
      b10T: (key) => key,
      b10UiLocale: { value: 'zh-CN' },
      b10ContentLocale: { value: 'en-US' },
    },
    '../../platform/b11-foundation': {
      b11T: (key) => key,
      b11ThemeMode: { value: 'light' },
      b11UiLocale: { value: 'zh-CN' },
      b11ContentLocale: { value: 'en-US' },
    },
    '../../platform/b11-recording': b11Recording,
    '../../api/b3': b3Api,
    '../../api/b10': {
      b10LearningApi,
      b10ErrorInfo: (_error, fallback) => ({ kind: 'error', message: fallback }),
      createB10ClientEventId: (prefix) => prefix,
    },
    '../../api/b11': b11Api,
    '../../domain/b11': { createB11ClientEventId: (prefix) => prefix },
    '../../auth/navigation': {
      ensureMobilePageAccess: async (target) => {
        calls.ensure.push(target)
        return session.isAuthenticated
      },
    },
    '../../stores/session': { useSessionStore: () => session },
    '../../stores/b4': { useB4Store: () => b4 },
    '../../stores/b11-learning': { useB11LearningStore: () => store },
  }

  const functionNames = ['backToLearning', 'openRelated', 'load', 'play', 'submit', 'startRecording', 'playAudio', 'requestPermission', 'playDemoAudio', 'syncPending']
  const presentFunctions = functionNames.filter((name) => new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(script))
  const refNames = [...script.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:ref|computed)\b/gu)].map((match) => match[1])
  const exported = `${script}\nexport const __test = { ${presentFunctions.join(', ')} };\nexport const __refs = { ${[...new Set(refNames)].join(', ')} };\n`
  const compiled = ts.transpileModule(exported, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return {
    source,
    template,
    calls,
    session,
    runtime,
    b4,
    store,
    mounted,
    shown,
    unmounted,
    test: module.exports.__test ?? {},
    refs: module.exports.__refs ?? {},
  }
}

export function closedNoticeRegion(template, terminator) {
  const start = template.indexOf('<MobileClosedPracticeNotice')
  const end = template.indexOf(terminator, start)
  if (start < 0 || end < 0) return ''
  return template.slice(start, end)
}
