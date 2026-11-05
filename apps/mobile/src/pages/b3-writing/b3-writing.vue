<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import MobileClosedPracticeNotice from '../../components/MobileClosedPracticeNotice.vue'
import AppIcon from '../../components/AppIcon.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10FeedbackCard from '../../components/b10/B10FeedbackCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import type { B10RuleFeedback, B10WritingPrompt } from '../../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../../api/b10'
import { b10ContentLocale, b10ThemeMode, b10T, b10UiLocale } from '../../platform/b10-foundation'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
const message = ref<string | null>(null)
const prompts = ref<B10WritingPrompt[]>([])
const selectedPrompt = ref<B10WritingPrompt | null>(null)
const answer = ref('')
const feedback = ref<B10RuleFeedback | null>(null)
const draftSavedAt = ref<string | null>(null)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const context = computed(() => ({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }))
const sourceText = computed(() => {
  const prompt = selectedPrompt.value
  if (!prompt?.sourceText || prompt.sourceText === prompt.taskText) return null
  return prompt.sourceText
})
const storageKey = 'yx.b10.mobile.writing.draft.v1'
const WRITING_PROMPT_TYPE_LABELS: Record<string, string> = { TRANSLATION: '翻译', EMAIL: '邮件', SHORT_ESSAY: '短文', SENTENCE: '句子', CORRECTION: '改错' }
function promptTypeLabel(promptType: unknown): string { return typeof promptType === 'string' ? (WRITING_PROMPT_TYPE_LABELS[promptType] ?? '写作') : '写作' }
function backToLearning(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }
function openRelated(url: string): void { getUniRuntime().navigateTo({ url }) }
const alternatives = [
  {
    id: 'vocab',
    target: '/pages/b2-vocabulary/b2-vocabulary',
    iconSrc: '/static/figma-closed-168-6945/160841d4-c5ed-477c-889d-09d66d800524.svg',
    chevronSrc: '/static/figma-closed-168-6945/3c5187e8-0de1-47b7-a99f-096226453a9f.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-6945/a2fb823f-a42c-4ae9-9e76-da240a0d712a.svg',
    chevronSrc: '/static/figma-closed-168-6945/3c5187e8-0de1-47b7-a99f-096226453a9f.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
let draftTimer: ReturnType<typeof setTimeout> | undefined
let loadRequest = 0
type AccountScope = { subject: string; revision: number }
function accountScope(): AccountScope | null {
  return session.isAuthenticated && session.verifiedSubject
    ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function clearPage(): void {
  loadRequest += 1
  clearTimeout(draftTimer)
  prompts.value = []
  selectedPrompt.value = null
  answer.value = ''
  feedback.value = null
  draftSavedAt.value = null
  status.value = 'idle'
  message.value = null
}

function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function discardDraft(): void { try { getUniRuntime().removeStorageSync(storageKey) } catch { /* storage unavailable */ } }
function persistDraft(): void {
  const scope = accountScope()
  const prompt = selectedPrompt.value
  if (!isCurrent(scope) || !prompt) return
  const savedAt = new Date().toISOString()
  try {
    getUniRuntime().setStorageSync(storageKey, JSON.stringify({ subject: scope.subject, promptId: prompt.promptId, contentVersionId: prompt.contentVersionId, ruleVersion: prompt.ruleVersion, text: answer.value, savedAt }))
    draftSavedAt.value = savedAt
  } catch {
    draftSavedAt.value = null
    message.value = '草稿未能保存。'
  }
}
function restoreDraft(): void {
  const scope = accountScope()
  if (!isCurrent(scope)) return
  try {
    const raw = getUniRuntime().getStorageSync(storageKey)
    if (typeof raw !== 'string') return
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value.subject !== scope.subject) { discardDraft(); return }
    const promptId = typeof value.promptId === 'number' ? value.promptId : 0
    const prompt = prompts.value.find((item) => item.promptId === promptId)
    if (!prompt || value.contentVersionId !== prompt.contentVersionId || value.ruleVersion !== prompt.ruleVersion) { discardDraft(); return }
    selectedPrompt.value = prompt
    answer.value = typeof value.text === 'string' ? value.text : ''
    draftSavedAt.value = typeof value.savedAt === 'string' ? value.savedAt : null
  } catch { discardDraft() }
}
async function load(): Promise<void> { const scope = accountScope(); if (!isCurrent(scope)) return; const requestId = ++loadRequest; status.value = 'loading'; message.value = null; try { const next = await b10LearningApi.listWritingPrompts(context.value); if (!isCurrent(scope) || requestId !== loadRequest) return; prompts.value = next; if (!prompts.value.length) { status.value = 'empty'; return } selectedPrompt.value ??= prompts.value[0]; restoreDraft(); status.value = 'ready' } catch (error) { if (!isCurrent(scope) || requestId !== loadRequest) return; const info = b10ErrorInfo(error, '写作服务暂时不可用。'); status.value = info.kind; message.value = info.message } }
function selectPrompt(index: number): void { selectedPrompt.value = prompts.value[index] ?? null; feedback.value = null; answer.value = ''; status.value = selectedPrompt.value ? 'ready' : 'empty'; restoreDraft() }
function onInput(): void { clearTimeout(draftTimer); draftTimer = setTimeout(persistDraft, 250) }
async function submit(): Promise<void> { const scope = accountScope(); if (!isCurrent(scope)) return; const prompt = selectedPrompt.value; const text = answer.value; if (!prompt || !text.trim()) { message.value = '请先读取题目并填写答案。'; return } status.value = 'loading'; message.value = null; const clientEventId = createB10ClientEventId(`writing-${prompt.promptId}`); try { const result = prompt.promptType === 'CORRECTION' ? await b10LearningApi.submitCorrection(context.value, prompt, text, clientEventId) : await b10LearningApi.submitWriting(context.value, prompt, text, prompt.promptType === 'TRANSLATION' ? 'TRANSLATION' : 'WRITING', clientEventId); if (!isCurrent(scope)) return; if (selectedPrompt.value !== prompt || answer.value !== text) { status.value = 'ready'; return } feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready'; message.value = result.contentVersionStale ? b10T('common.stale') : null; persistDraft() } catch (error) { if (!isCurrent(scope)) return; if (selectedPrompt.value !== prompt || answer.value !== text) { status.value = 'ready'; return } const info = b10ErrorInfo(error, '写作提交失败，草稿仍保留。'); status.value = info.kind; message.value = info.message; persistDraft() } }
watch(answer, onInput)
watch(() => session.identityRevision, clearPage, { flush: 'sync' })
onMounted(async () => { await session.restore(); if (!await ensureMobilePageAccess('/pages/b3-writing/b3-writing')) return; /* closed practice: no live load */ undefined })
onUnmounted(() => { clearTimeout(draftTimer); engine.dispose() })
</script>

<template>
  <view class="yx-page v2-closed-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b3-writing" compact :title="mobileT('closed.writing.navTitle')" back-icon-src="/static/figma-closed-168-6945/c2887965-483d-4879-8090-ebece5c7c6a6.svg" :show-settings="false" />
    <MobileClosedPracticeNotice
      variant="writing"
      title-key="closed.writing.title"
      description-key="closed.writing.reason"
      aria-label-key="closed.writing.title"
      glow-src="/static/figma-closed-168-6945/b58014db-d97f-4102-b67a-add6a602160c.svg"
      icon-src="/static/figma-closed-168-6945/3cfa29d3-5518-43db-9c68-8ddefe5c9e9a.svg"
      :alternatives="alternatives"
      @back="backToLearning"
      @select="openRelated"
    />

    <B10StatusPanel class="v2-b3write-status" :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />
    <view v-if="prompts.length" class="yx-card b10-writing-card card v2-b3write-card"><view class="eyebrow v2-b3write-eyebrow"><AppIcon name="type" :size="14" /><text>写作题目</text></view><picker class="v2-b3write-picker" :range="prompts.map((prompt) => `${promptTypeLabel(prompt.promptType)} · ${prompt.title}`)" :value="Math.max(0, prompts.findIndex((prompt) => prompt.promptId === selectedPrompt?.promptId))" @change="selectPrompt(Number($event.detail.value))"><view class="b10-prompt-picker opt v2-b3write-opt v2-b3write-picker btn">{{ promptTypeLabel(selectedPrompt?.promptType) }} · {{ selectedPrompt?.title }}<AppIcon name="chev" :size="14" /></view></picker><view class="v2-b3write-head"><view class="v2-b3write-titles"><text class="b10-kicker v2-b3write-kicker">{{ promptTypeLabel(selectedPrompt?.promptType) }}</text><text class="v2-b3write-title v2-b3write-h2">{{ selectedPrompt?.title }}</text></view></view><text v-if="sourceText" class="b10-writing-card__source">{{ sourceText }}</text><text class="b10-writing-card__task d v2-b3write-d v2-b3write-stem">{{ selectedPrompt?.taskText }}</text><view v-if="selectedPrompt?.targetStructure?.length" class="b10-targets v2-b3write-list"><text v-for="target in selectedPrompt.targetStructure" :key="target" class="b10-target opt v2-b3write-opt v2-b3write-row"><AppIcon name="list" :size="14" />{{ target }}</text></view><textarea v-model="answer" class="b10-textarea v2-b3write-input" maxlength="12000" placeholder="输入答案；提交后由服务端返回规则反馈。" /><view class="b10-draft-row v2-b3write-row"><text class="d v2-b3write-d">{{ b10T('writing.draft') }}：{{ draftSavedAt ? '已保存' : '输入中' }}</text><button tabindex="0" role="button" class="b10-draft-button btn opt v2-b3write-btn v2-b3write-opt" type="button" @click="persistDraft">{{ b10T('writing.save') }}</button></view><button tabindex="0" role="button" class="yx-button btn v2-b3write-btn v2-b3write-submit" type="button" @click="submit"><AppIcon name="check" :size="14" />{{ selectedPrompt?.promptType === 'CORRECTION' ? b10T('writing.correction') : b10T('writing.submit') }}</button></view>
    <view v-else-if="status === 'loading'" class="yx-card b10-empty card v2-b3write-card"><view class="eyebrow v2-b3write-eyebrow"><AppIcon name="refresh" :size="14" /><text>加载中</text></view><text class="d v2-b3write-d">{{ b10T('status.loading') }}</text></view>
    <view v-else class="yx-card b10-empty card v2-b3write-card"><view class="eyebrow v2-b3write-eyebrow"><AppIcon name="inbox" :size="14" /><text>暂无题目</text></view><text class="v2-b3write-title v2-b3write-h2">{{ b10T('writing.noPrompt') }}</text><text class="d v2-b3write-d">题目还在准备，提交与反馈链也没接好；现在放空白编辑器写了也存不下来，所以没放。</text><button tabindex="0" role="button" class="yx-button btn v2-b3write-btn v2-b3write-submit" type="button" @click="load"><AppIcon name="refresh" :size="14" />{{ b10T('status.retry') }}</button></view>
    <B10FeedbackCard class="v2-b3write-fb" :feedback="feedback" />
  </view>
</template>

<style scoped lang="scss">
.b10-writing-card{display:grid;gap:18rpx}.b10-prompt-picker{min-height:72rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:25rpx;line-height:72rpx}.b10-writing-card__source,.b10-writing-card__task{color:var(--yx-text-primary);font-size:28rpx;line-height:1.7}.b10-writing-card__source{padding:18rpx;border-radius:12rpx;background:var(--yx-surface-soft)}.b10-targets{display:flex;flex-wrap:wrap;gap:10rpx}.b10-target{padding:8rpx 14rpx;border-radius:999rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:21rpx}.b10-textarea{width:100%;min-height:300rpx;box-sizing:border-box;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card);font-size:26rpx;line-height:1.6}.b10-draft-row{display:flex;align-items:center;justify-content:space-between;color:var(--yx-text-tertiary);font-size:21rpx}.b10-draft-button{min-height:58rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}
/* v2 写作页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-b3write-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3write-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b3write-card:hover{border-color:var(--v2-brand)}
.v2-b3write-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b3write-title,.v2-b3write-h2{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b3write-kicker{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;line-height:1.5;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b3write-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b3write-head>*{min-width:0;max-width:100%}
.v2-b3write-titles{display:flex;flex-direction:column;gap:var(--v2-space-2);flex:1 1 auto;box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3write-titles>*{min-width:0;max-width:100%}
.v2-b3write-status{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3write-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3write-stem{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b3write-picker{display:flex;box-sizing:border-box;max-width:100%;min-width:0}
.v2-b3write-list{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3write-list>*{min-width:0;max-width:100%}
.v2-b3write-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-b3write-row:hover{border-color:var(--v2-brand)}
.v2-b3write-row>*{min-width:0;max-width:100%}
.v2-b3write-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b3write-opt:hover{border-color:var(--v2-brand)}
.v2-b3write-opt:active{transform:scale(.97)}
.v2-b3write-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3write-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b3write-opt.v2-b3write-row{width:100%;justify-content:flex-start;white-space:normal;text-align:left}
.v2-b3write-list .v2-b3write-opt{width:auto;flex:1 1 auto;justify-content:flex-start;white-space:normal;text-align:left}
.v2-b3write-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b3write-row .v2-b3write-btn{width:auto;flex:0 0 auto}
.v2-b3write-btn:hover{border-color:var(--v2-brand)}
.v2-b3write-btn:active{transform:scale(.97)}
.v2-b3write-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3write-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b3write-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-b3write-submit:hover{border-color:var(--v2-brand)}
.v2-b3write-input{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:440rpx;padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3write-input::placeholder{color:var(--v2-mut)}
.v2-b3write-input:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3write-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3write-fb.ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-b3write-fb.no{background:var(--v2-bad-soft);color:var(--v2-bad)}
/* m01 关闭提示：参考 Figma 168:6945，关闭态卡片与可练替代入口；不含设备外壳或假状态栏。 */
.v2-b3write-page.v2-b3write-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-b3write-body{min-height:calc(100vh - 190px)}
.v2-b3write-closed{display:flex;flex:1 1 auto;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%;padding-bottom:calc(var(--v2-space-2) + env(safe-area-inset-bottom));font-family:var(--v2-font)}
.v2-b3write-scroll{display:flex;flex:1 1 auto;flex-direction:column;justify-content:center;gap:var(--v2-space-3);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-2) 0}
.v2-b3write-hero{display:flex;flex-direction:column;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;max-width:520px;margin:0 auto;padding:28px 20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);text-align:center}
.v2-b3write-art{display:flex;flex:none;align-items:center;justify-content:center;width:88px;height:88px;border-radius:28px;background:linear-gradient(128deg,var(--v2-ok) 7%,var(--v2-info) 82%);box-shadow:var(--v2-shadow-pop);color:var(--v2-inverse)}
.v2-b3write-tag{margin-left:0;padding:3px 10px;border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-b3write-herotitle{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:22px;font-weight:700;line-height:1.4;text-align:center;overflow-wrap:anywhere}
.v2-b3write-desc{display:block;max-width:320px;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.65;text-align:center;overflow-wrap:anywhere}
.v2-b3write-alt{box-sizing:border-box;width:100%;min-width:0;max-width:520px;margin:0 auto;padding:6px 20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b3write-alttitle{display:block;padding:10px 0 8px;color:var(--v2-ink);font-family:var(--v2-font);font-size:18px;font-weight:700;line-height:1.5}
.v2-b3write-divider{height:1px;background:var(--v2-line)}
.v2-b3write-altrow{display:flex;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;min-height:56px;margin:0;padding:10px 0;border:0;border-radius:0;background:transparent;color:var(--v2-mut);font-family:var(--v2-font);text-align:left}
.v2-b3write-altrow:hover{background:var(--v2-surface)}
.v2-b3write-altrow:active{transform:none}
.v2-b3write-altrow:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3write-alttile{display:flex;flex:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:var(--v2-soft);color:var(--v2-brand)}
.v2-b3write-alttile--ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-b3write-altcopy{display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0;max-width:100%}
.v2-b3write-altname{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:15px;font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-b3write-altmeta{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.5;overflow-wrap:anywhere}
.v2-b3write-bottom{display:flex;justify-content:center;margin-top:auto;padding:var(--v2-space-3) 0 var(--v2-space-2);border-top:1px solid var(--v2-line);background:var(--v2-card)}
.v2-b3write-cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:0;padding:14px 20px;border:0;border-radius:14px;background:var(--v2-grad);color:var(--v2-inverse);font-family:var(--v2-font);font-size:var(--v2-text-md);font-weight:700;line-height:1.5;box-shadow:var(--v2-shadow)}
.v2-b3write-cta:hover{border-color:var(--v2-brand)}
.v2-b3write-cta:active{transform:scale(.99)}
.v2-b3write-cta:focus-visible{box-shadow:var(--v2-focus);outline:none}
@media(max-width:360px){.v2-b3write-page.yx-page{padding-inline:16px}.v2-b3write-hero{padding:24px 16px;border-radius:20px}.v2-b3write-art{width:76px;height:76px;border-radius:24px}.v2-b3write-herotitle{font-size:20px}.v2-b3write-desc{max-width:100%}.v2-b3write-alt{padding:6px 16px;border-radius:20px}.v2-b3write-altname{font-size:14px}}
@media(prefers-reduced-motion:reduce){.v2-b3write-cta{transition:none}}
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
