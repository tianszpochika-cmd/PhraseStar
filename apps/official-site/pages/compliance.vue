<script setup lang="ts">
import InfoLegal from "~/components/v1/info/InfoLegal.vue";
const { t } = useSiteText();
const { loadState, load, getFacet } = usePublicProjection("compliance");
const facet = computed(() => getFacet("compliance"));
const canShow = computed(() => ["ready", "recovery"].includes(facet.value.state));
const notices = computed(() => canShow.value ? loadState.value.projection.complianceNotices : []);
</script>
<template>
  <InfoLegal kind="compliance">
    <template #after-document>
      <section class="v1-info-compliance-notices">
        <h2>{{ t("official.v1.info.legal.compliance.noticesTitle") }}</h2>
        <p>{{ t("official.v1.info.legal.compliance.noticesIntro") }}</p>
        <p v-if="facet.state === 'recovery'" class="v1-info-compliance-notices__recovery" role="status">
          {{ t("official.v1.info.legal.compliance.recovery") }}
          <span v-if="facet.updatedAt">{{ t("official.v1.info.legal.compliance.updated") }}{{ facet.updatedAt.slice(0, 10) }}</span>
          <button type="button" @click="load">{{ t("official.v1.info.legal.compliance.retry") }}</button>
        </p>
        <p v-else-if="facet.updatedAt && facet.state === 'ready'" class="v1-info-compliance-notices__updated">{{ t("official.v1.info.legal.compliance.updated") }}{{ facet.updatedAt.slice(0, 10) }}</p>
        <div v-if="notices.length" class="v1-info-compliance-notices__items">
          <article v-for="notice in notices" :key="notice.id"><span v-if="notice.status">{{ notice.status }}</span><h3>{{ notice.title }}</h3><p>{{ notice.description }}</p></article>
        </div>
        <p v-else-if="canShow || facet.state === 'empty'" class="v1-info-compliance-notices__empty" role="status">{{ t("official.v1.info.legal.compliance.empty") }}</p>
        <PublicStatus v-else :state="facet.state" @retry="load" />
      </section>
    </template>
  </InfoLegal>
</template>
<style scoped>
.v1-info-compliance-notices { min-height: 145px; margin-top: 24px; padding: 29px 22px; border-radius: 20px; background: var(--v1-bg); color: var(--v1-text); }
.v1-info-compliance-notices h2 { font-size: 21px; }
.v1-info-compliance-notices > p { margin-top: 18px; color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-info-compliance-notices__recovery button { min-height: 44px; margin-left: 8px; color: var(--v1-brand); font-weight: 700; }
.v1-info-compliance-notices__items { display: grid; gap: 12px; margin-top: 18px; }
.v1-info-compliance-notices__items article { padding: 18px; border: 1px solid var(--v1-border); border-radius: 14px; background: var(--v1-surface); }
.v1-info-compliance-notices__items span { color: var(--v1-brand); font-size: 12px; font-weight: 600; }
.v1-info-compliance-notices__items h3 { margin-top: 4px; font-size: 18px; }
.v1-info-compliance-notices__items p { margin-top: 8px; color: var(--v1-muted); line-height: 1.6; }
.v1-info-compliance-notices :deep(.public-status) { margin-top: 18px; }
.v1-info-compliance-notices :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
:global(html[data-theme="high-contrast"]) .v1-info-compliance-notices { border: 1px solid var(--v1-border); }
@media (max-width: 800px) { .v1-info-compliance-notices { min-height: 142px; } }
</style>
