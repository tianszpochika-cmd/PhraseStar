<script setup lang="ts">
const { t } = useSiteText();
const route = useRoute();
const main = ref<HTMLElement>();
watch(
  () => route.path,
  async () => {
    await nextTick();
    main.value?.focus({ preventScroll: true });
  },
);
</script>
<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">{{ t("official.cd42c35cd6") }}</a>
    <SiteHeader />
    <main id="main-content" ref="main" tabindex="-1"><slot /></main>
    <SiteFooter />
  </div>
</template>
