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
const { loadState } = usePublicProjection("home");
const coursesFacet = computed(() => loadState.value.facets?.courses ?? {
  state: loadState.value.state,
  updatedAt: null as string | null,
  errorCode: loadState.value.errorCode,
  stale: loadState.value.stale,
});
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
      <HomePillars class="home-pillars">
        <p v-if="coursesFacet.updatedAt" class="catalog-message">{{ t('official.v1.home.catalog.updated') }}{{ coursesFacet.updatedAt.slice(0, 10) }}</p>
        <p v-if="coursesFacet.stale" class="catalog-message" role="status">{{ t('official.v1.home.catalog.stale') }}</p>
        <p v-else-if="coursesFacet.state === 'permission'" class="catalog-message" role="status">{{ t('official.v1.home.catalog.permission') }}</p>
        <p v-else-if="coursesFacet.state === 'maintenance'" class="catalog-message" role="status">{{ t('official.v1.home.catalog.maintenance') }}</p>
        <p v-else-if="['error', 'recovery'].includes(coursesFacet.state)" class="catalog-message" role="status">{{ t('official.v1.home.catalog.unavailable') }}</p>
        <p v-else-if="['ready', 'empty'].includes(coursesFacet.state) && !loadState.projection.courses.length" class="catalog-message" role="status">{{ t('official.v1.home.catalog.empty') }}</p>
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
.home-middle { display: flex; flex-direction: column; }.catalog-message { margin-top: 12px; color: var(--v1-muted); font-size: 13px; }
@media (max-width: 700px) { .home-practice { order: -1; } }
</style>
