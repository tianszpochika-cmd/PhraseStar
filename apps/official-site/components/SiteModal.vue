<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string; menu?: boolean; bare?: boolean; closeText?: boolean }>(),
  emit = defineEmits<{ close: [] }>(),
  { t } = useSiteText();
const titleId = useId();
const element = ref<HTMLDialogElement>();
let opener: HTMLElement | null = null;
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      opener = document.activeElement as HTMLElement;
      if (!element.value?.open) element.value?.showModal();
    } else if (element.value?.open) element.value.close();
  },
);
function closed() {
  emit("close");
  if (opener?.isConnected && !document.querySelector("dialog[open]"))
    opener.focus({ preventScroll: true });
}
function keepFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !element.value) return;
  const candidates = Array.from(element.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((item) => item.getClientRects().length > 0 && item.tabIndex >= 0
    && !item.matches(":disabled") && item.getAttribute("aria-hidden") !== "true" && !item.closest("[inert]"));
  const focusable = candidates.filter((item) => {
    if (item.tagName !== "INPUT") return true;
    const input = item as HTMLInputElement;
    if (input.type !== "radio" || !input.name) return true;
    const group = candidates.filter((candidate) => candidate.tagName === "INPUT"
      && (candidate as HTMLInputElement).type === "radio"
      && (candidate as HTMLInputElement).name === input.name) as HTMLInputElement[];
    return input === (group.find((candidate) => candidate.checked) ?? group[0]);
  });
  if (!focusable.length) {
    event.preventDefault();
    element.value.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && (document.activeElement === first || !element.value.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !element.value.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}
function backdrop(event: MouseEvent) {
  if (event.target !== element.value) return;
  const r = element.value!.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    emit("close");
}
onBeforeUnmount(() => element.value?.close());
</script>
<template>
  <dialog
    ref="element"
    tabindex="-1"
    :class="{ 'nav-dialog v1-menu-dialog': menu, 'v1-dialog-bare': bare }"
    :aria-labelledby="titleId"
    @keydown="keepFocus"
    @close="closed"
    @cancel="emit('close')"
    @click="backdrop"
  >
    <div v-if="!bare" class="dialog-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button
        :class="closeText ? 'v1-dialog-close-text' : 'round-button'"
        :aria-label="t('official.c6c14bd7f6')"
        @click="emit('close')"
      >
        <template v-if="closeText">{{ t("official.v1.common.nav.close") }}</template>
        <SiteIcon v-else name="close" />
      </button>
    </div>
    <h2 v-else :id="titleId" class="v1-sr-only">{{ title }}</h2>
    <div class="dialog-content"><slot /></div>
  </dialog>
</template>
