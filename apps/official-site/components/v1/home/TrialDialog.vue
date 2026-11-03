<script setup lang="ts">
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useSiteText();
const dialog = ref<HTMLDialogElement>();
const firstChoice = ref<HTMLButtonElement>();
const result = ref<HTMLElement>();
const selected = ref<'read' | 'reading' | 'to read' | null>(null);
const complete = computed(() => selected.value === 'reading');
const stateName = computed(() => selected.value === 'read' ? 'hint-read' : selected.value === 'to read' ? 'hint-to-read' : complete.value ? 'complete' : 'select');
const stateNodes = {
  desktop: { select: '203-180', 'hint-read': '203-204', 'hint-to-read': '203-228', complete: '203-252' },
  mobile: { select: '203-273', 'hint-read': '203-297', 'hint-to-read': '203-321', complete: '203-345' },
} as const;
const logo = (device: 'desktop' | 'mobile') => `/figma-v1/assets/trial-${device}-${stateName.value}-${stateNodes[device][stateName.value]}/imgOfficialLogoImageOriginal.png`;
const feedbackTitle = computed(() => selected.value === 'read' ? 'wrongReadTitle' : selected.value === 'to read' ? 'wrongToReadTitle' : complete.value ? 'successTitle' : 'hintTitle');
const feedbackText = computed(() => selected.value === 'read' ? 'wrongRead' : selected.value === 'to read' ? 'wrongToRead' : complete.value ? 'success' : 'hint');
const titleId = useId();
let opener: HTMLElement | null = null;
watch(() => props.open, async (open) => {
  if (open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selected.value = null;
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
  } else if (dialog.value?.open) dialog.value.close();
});
function close() { emit('close'); }
function closed() {
  if (props.open) emit('close');
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return;
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length > 0);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function backdrop(event: MouseEvent) {
  const element = dialog.value;
  if (!element || event.target !== element) return;
  const rect = element.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
}
async function choose(answer: 'read' | 'reading' | 'to read') {
  selected.value = answer;
  if (answer === 'reading') { await nextTick(); result.value?.focus({ preventScroll: true }); }
}
async function reset() { selected.value = null; await nextTick(); firstChoice.value?.focus({ preventScroll: true }); }
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close(); });
</script>
<template>
  <dialog ref="dialog" class="trial-dialog" :aria-labelledby="titleId" @cancel.prevent="close" @close="closed" @click="backdrop" @keydown="trapFocus">
    <div class="trial-content">
      <div class="trial-header"><picture><source media="(max-width: 700px)" :srcset="logo('mobile')" /><img :src="logo('desktop')" alt="" width="29" height="29" /></picture><p>{{ t('official.v1.home.practice.lesson') }}</p><button type="button" autofocus :aria-label="t('official.v1.home.practice.close')" @click="close">×</button></div>
      <div class="trial-title"><p>{{ t('official.v1.home.practice.lessonNumber') }}</p><h2 :id="titleId">{{ t(complete ? 'official.v1.home.practice.completedTitle' : 'official.v1.home.practice.lessonTitle') }}</h2></div>
      <div class="trial-sentence"><p lang="en">{{ t(complete ? 'official.v1.home.practice.correctSentence' : 'official.v1.home.practice.sentence') }}</p><small>{{ t('official.v1.home.practice.translation') }}</small></div>
      <template v-if="!complete"><p class="trial-question">{{ t('official.v1.home.practice.modalChoose') }}</p><div class="trial-choices"><button ref="firstChoice" type="button" :class="{ selected: selected === 'read' }" :aria-pressed="selected === 'read'" @click="choose('read')">read</button><button type="button" :aria-pressed="false" @click="choose('reading')">reading</button><button type="button" :class="{ selected: selected === 'to read' }" :aria-pressed="selected === 'to read'" @click="choose('to read')">to read</button></div></template>
      <div ref="result" class="trial-feedback" :class="{ correct: complete, wrong: selected && !complete }" :tabindex="complete ? -1 : undefined" role="status" aria-live="polite"><strong>{{ t(`official.v1.home.practice.${feedbackTitle}`) }}</strong><p>{{ t(`official.v1.home.practice.${feedbackText}`) }}</p></div>
      <div v-if="complete" class="trial-actions"><button type="button" @click="reset">{{ t('official.v1.home.practice.restart') }}</button><button type="button" @click="close">{{ t('official.v1.home.practice.finish') }}</button></div>
    </div>
  </dialog>
</template>
<style scoped>
.trial-dialog { width: min(480px, calc(100vw - 32px)); max-width: 480px; max-height: calc(100dvh - 40px); padding: 0; border: 1px solid var(--v1-border); border-radius: 24px; background: var(--v1-surface); color: var(--v1-text); box-shadow: 0 8px 30px color-mix(in srgb, var(--v1-text) 15%, transparent); font-family: var(--v1-font-sans); }.trial-content { display: flex; flex-direction: column; gap: 16px; padding: 28px; }.trial-header { display: flex; height: 44px; align-items: center; gap: 9px; }.trial-header picture { flex: none; }.trial-header img { width: 29px; height: 29px; }.trial-header p { flex: 1; color: var(--v1-brand-caption); font: 600 11px/16px var(--v1-font-display); letter-spacing: .04em; }.trial-header button { display: grid; flex: none; width: 44px; height: 44px; place-items: center; border-radius: 12px; background: var(--v1-bg); color: var(--v1-text); font: 600 17px/1 var(--v1-font-display); }.trial-title p { color: var(--v1-brand-caption); font-size: 12px; font-weight: 500; line-height: 20px; }.trial-title h2 { margin-top: 3px; color: var(--v1-text); font-size: 28px; line-height: 40px; }.trial-sentence { padding: 14px; border-radius: 14px; background: var(--v1-brand-soft); }.trial-sentence p { color: var(--v1-brand-strong); font: 600 25px/34px var(--v1-font-display); }.trial-sentence small { display: block; margin-top: 5px; color: var(--v1-muted); font-size: 13px; line-height: 21px; }.trial-question { color: var(--v1-text); font-size: 14px; line-height: 22px; }.trial-choices, .trial-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.trial-choices button, .trial-actions button { min-height: 46px; border-radius: 12px; background: var(--v1-brand-soft); color: var(--v1-brand-strong); font: 600 17px/22px var(--v1-font-display); }.trial-choices button.selected { outline: 1px solid var(--v1-warning-fg); outline-offset: -1px; background: var(--v1-warning-bg); color: var(--v1-warning-fg); }.trial-feedback { padding: 13px; border-radius: 12px; background: var(--v1-bg); color: var(--v1-text); }.trial-feedback strong { display: block; font-size: 14px; line-height: 22px; }.trial-feedback p { margin-top: 3px; color: var(--v1-muted); font-size: 13px; line-height: 21px; }.trial-feedback.wrong { background: var(--v1-warning-bg); color: var(--v1-warning-fg); }.trial-feedback.wrong p { color: var(--v1-warning-fg); }.trial-feedback.correct { background: var(--v1-success-bg); color: var(--v1-success-fg); }.trial-feedback.correct p { color: var(--v1-success-fg); }.trial-actions { grid-template-columns: 2fr 2.88fr; }.trial-actions button { font: 700 14px/22px var(--v1-font-sans); }.trial-actions button + button { background: var(--v1-brand); color: var(--v1-on-brand); }
:global(html[data-theme="high-contrast"]) .trial-header button:not(:focus-visible), :global(html[data-theme="high-contrast"]) .trial-choices button:not(:focus-visible), :global(html[data-theme="high-contrast"]) .trial-feedback, :global(html[data-theme="high-contrast"]) .trial-actions button:first-child:not(:focus-visible) { outline: 1px solid var(--v1-border); outline-offset: -1px; }
@media (max-width: 700px) { .trial-dialog { width: min(342px, calc(100vw - 32px)); max-width: 342px; max-height: calc(100dvh - 28px); }.trial-content { gap: 13px; padding: 20px; }.trial-title h2 { font-size: 23px; line-height: 34px; }.trial-sentence p { font-size: 21px; line-height: 27px; } }
</style>
