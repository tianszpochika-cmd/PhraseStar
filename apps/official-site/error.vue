<script setup lang="ts">
import { renderOfficialSiteV1Theme } from "@englishflow/design-tokens/official-site-v1";
import { resolvePublicThemeMode } from "~/utils/public-projection";

const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>();
const { t } = useSiteText();
const route = useRoute();
const themeCookie = useCookie<string>("yx.public.theme");
const theme = resolvePublicThemeMode(route.query.theme ?? themeCookie.value);
const { officialThemeController, officialThemeAdapter } = useNuxtApp().$foundation;
const code = computed(() => Number.isInteger(props.error.statusCode) && props.error.statusCode! >= 400 && props.error.statusCode! <= 599 ? props.error.statusCode! : 500);
useHead({
  title: t("official.cf9e4e94e2"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
  htmlAttrs: { "data-theme": theme === "system" ? undefined : theme },
  style: [{ id: "englishflow-official-error-tokens", textContent: renderOfficialSiteV1Theme() }],
  script: theme === "system" ? [{
    id: "englishflow-official-error-theme-bootstrap",
    textContent: 'document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";',
  }] : [],
});
onMounted(() => {
  officialThemeController.restore();
  if (route.query.theme !== undefined)
    officialThemeController.setTheme(resolvePublicThemeMode(route.query.theme));
  officialThemeAdapter.sync();
});
</script>
<template>
  <main class="v1-info-error">
    <div class="v1-info-error__inner">
      <SiteBrand class="v1-info-error__brand" @click.prevent="clearError({ redirect: '/' })" />
      <section class="v1-info-error__card">
        <p class="v1-info-error__code">{{ code }}</p>
        <h1>{{ t(code === 404 ? "official.c763d67d09" : "official.cbbc736f68") }}</h1>
        <p class="v1-info-error__text">{{ t("official.cdcbe15e69") }}</p>
        <button type="button" @click="clearError({ redirect: '/' })">{{ t("official.cab85b3ad3") }}</button>
      </section>
    </div>
  </main>
</template>
<style scoped>
.v1-info-error { min-height: 100vh; padding: min(25.23vh, 227px) 24px 80px; color: var(--v1-text); background: var(--v1-surface); font-family: var(--v1-font-sans); }
.v1-info-error__inner { width: min(720px, 100%); margin: 0 auto; }
.v1-info-error__brand :deep(.v1-brand__mark) { width: 34px; height: 34px; }
.v1-info-error__brand :deep(.v1-brand__backdrop) { display: none; }
.v1-info-error__brand :deep(.v1-brand__logo) { width: 34px; height: 34px; }
.v1-info-error__brand :deep(.v1-brand__wordmark) { margin-left: 6px; }
.v1-info-error__brand :deep(strong) { font-size: 23px; }
.v1-info-error__brand :deep(.v1-brand__wordmark span) { font-size: 13px; }
.v1-info-error__card { min-height: 330px; margin-top: 41px; padding: 31px 24px 24px; border-radius: 25px; background: var(--v1-brand-soft); }
.v1-info-error__code { color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-error__card h1 { margin-top: 38px; font-size: 34px; }
.v1-info-error__text { margin-top: 35px; color: var(--v1-muted); font-size: 15px; }
.v1-info-error__card button { display: grid; width: 229px; min-height: 52px; place-items: center; margin-top: 50px; border-radius: 14px; background: var(--v1-brand); color: var(--v1-on-brand); font-size: 15px; font-weight: 700; }
.v1-info-error :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
:global(html[data-theme="high-contrast"]) .v1-info-error__card { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-error { padding-top: min(14.46vh, 122px); }
 .v1-info-error__card h1 { font-size: 23px; }
 .v1-info-error__card button { width: min(239px, 100%); }
}
</style>
