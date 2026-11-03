<script setup lang="ts">
import HomeHero from "~/components/v1/home/Hero.vue";
import HomePromises from "~/components/v1/home/Promises.vue";
import HomePillars from "~/components/v1/home/Pillars.vue";
import HomePractice from "~/components/v1/home/Practice.vue";
import HomeMethod from "~/components/v1/home/Method.vue";
import HomeExplore from "~/components/v1/home/Explore.vue";
import HomeFaqCta from "~/components/v1/home/FaqCta.vue";
import HomeTrialDialog from "~/components/v1/home/TrialDialog.vue";
import { useOfficialSeo } from "~/utils/seo";

const { t } = useSiteText();
const sampleOpen = ref(false);
const { loadState, load } = usePublicProjection("home");
const retryPending = ref(false);
const retryControl = ref<HTMLButtonElement>();
const coursesFacet = computed(() => loadState.value.facets?.courses ?? {
  state: loadState.value.state,
  updatedAt: null as string | null,
  errorCode: loadState.value.errorCode,
  stale: loadState.value.stale,
});
const statusKey = computed(() => {
  const facet = coursesFacet.value;
  if (retryPending.value || facet.state === 'loading') return 'loading';
  if (facet.state === 'permission' || facet.state === 'maintenance') return facet.state;
  if (facet.state === 'error') return 'unavailable';
  if (facet.stale) return 'stale';
  if (facet.state === 'recovery') return 'recovery';
  if (facet.state === 'empty' || (facet.state === 'ready' && !loadState.value.projection.courses.length)) return 'empty';
  return null;
});
const hasStatus = computed(() => Boolean(statusKey.value || coursesFacet.value.updatedAt));
const showRetry = computed(() => retryPending.value || Boolean(statusKey.value && statusKey.value !== 'loading'));
async function retryCatalog() {
  if (retryPending.value) return;
  const restoreFocus = document.activeElement === retryControl.value;
  retryPending.value = true;
  try { await load(); }
  finally {
    retryPending.value = false;
    await nextTick();
    if (restoreFocus && !showRetry.value)
      document.getElementById('home-pillars-title')?.focus({ preventScroll: true });
  }
}
useOfficialSeo({
  title: t("official.cb2ffbd59f"),
  description: t("official.cea0be3689"),
  path: "/",
});
</script>
<template>
  <div>
    <HomeHero @open-practice="sampleOpen = true" />
    <HomePromises />
    <div class="home-middle">
      <HomePillars class="home-pillars" :has-status="hasStatus" :has-retry="showRetry">
        <div v-if="hasStatus" class="catalog-status">
          <span v-if="statusKey" class="catalog-message" role="status" aria-live="polite">{{ t(`official.v1.home.catalog.${statusKey}`) }}</span>
          <span v-else class="catalog-motto">{{ t('official.v1.home.pillars.caption') }}</span>
          <span v-if="coursesFacet.updatedAt" class="catalog-time">{{ t('official.v1.home.catalog.updated') }}{{ coursesFacet.updatedAt.slice(0, 10) }}</span>
          <button v-if="showRetry" ref="retryControl" type="button" class="catalog-retry" :aria-disabled="retryPending" @click="retryCatalog">{{ t('official.v1.home.catalog.retry') }}</button>
        </div>
      </HomePillars>
      <HomePractice class="home-practice" />
    </div>
    <HomeMethod />
    <HomeExplore />
    <HomeFaqCta />
    <HomeTrialDialog :open="sampleOpen" @close="sampleOpen = false" />
  </div>
</template>
<style scoped>
.home-middle { display: flex; flex-direction: column; }.catalog-status { display: flex; min-height: 44px; align-items: center; flex-wrap: wrap; gap: 4px 12px; color: var(--v1-muted); font-size: 13px; line-height: 20px; }.catalog-message, .catalog-motto { flex: 1 1 150px; }.catalog-motto { font-size: 15px; }.catalog-time { white-space: nowrap; }.catalog-retry { min-width: 44px; min-height: 44px; margin-left: auto; color: var(--v1-brand); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }.catalog-retry[aria-disabled="true"] { opacity: .7; }
@media (max-width: 700px) { .home-practice { order: -1; }.catalog-status { min-height: 37px; gap: 0 8px; font-size: 12px; }.catalog-message { flex: 1 1 120px; }.catalog-motto { display: none; } }
</style>
