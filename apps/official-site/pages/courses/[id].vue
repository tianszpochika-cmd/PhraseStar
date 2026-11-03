<script setup lang="ts">
import CoreHero from "~/components/v1/core/Hero.vue";
import CoreFeatureCards from "~/components/v1/core/FeatureCards.vue";
import { directions, directionTextKey } from "~/components/v1/core/catalog";
import { useOfficialSeo } from "~/utils/seo";

definePageMeta({
  key: (route) => route.path,
  validate: (route) => directions.some((item) => item.id === route.params.id),
});
const { t } = useSiteText();
const route = useRoute();
const direction = computed(() => directions.find((item) => item.id === route.params.id));
if (!direction.value) throw createError({ statusCode: 404, statusMessage: "Learning direction not found" });
const title = computed(() => `${t(directionTextKey(direction.value!, "title"))} ${t("official.v1.core.detail.titleSuffix")}`);
const steps = ["first", "second", "third"] as const;
const features = computed(() => [
  { title: t("official.v1.core.detail.focus"), description: t(directionTextKey(direction.value!, "short")) },
  { title: t("official.v1.core.detail.review"), description: t("official.v1.core.detail.reviewNote") },
  { title: t("official.v1.core.detail.progress"), description: t("official.v1.core.detail.progressNote") },
]);
useOfficialSeo({ title: `${title.value} · 语学星`, description: t(directionTextKey(direction.value, "intro")), path: `/courses/${direction.value.id}` });
</script>
<template>
  <div v-if="direction" class="v1-core-detail">
    <CoreHero variant="detail" :eyebrow="t('official.v1.core.detail.eyebrow')" :title="title" :lead="t('official.v1.core.detail.lead')" :art-eyebrow="t('official.v1.core.detail.artEyebrow')" :art-title="t('official.v1.core.detail.artTitle')" :art-count="t('official.v1.core.detail.artCount')" :caption="t('official.v1.core.detail.artCaption')" />
    <div class="v1-core-detail__container">
      <section class="v1-core-detail__intro" aria-labelledby="detail-intro-title">
        <div class="v1-core-detail__intro-copy">
          <p class="v1-core-detail__eyebrow">{{ t(directionTextKey(direction, "code")) }} / {{ t("official.v1.core.detail.methodLabel") }}</p>
          <h2 id="detail-intro-title">{{ t(directionTextKey(direction, "headline")) }}</h2>
          <p>{{ t(directionTextKey(direction, "intro")) }}</p>
          <SiteStartButton :label="t('official.v1.core.detail.start')" :show-icon="false" />
        </div>
        <div class="v1-core-detail__example" :aria-label="t('official.v1.core.detail.exampleAria')">
          <p>{{ t("official.v1.core.detail.exampleLabel") }}</p><strong>{{ t("official.v1.core.detail.exampleWord") }}</strong>
          <small>{{ t("official.v1.core.detail.exampleMeaning") }}</small><span>{{ t("official.v1.core.detail.exampleFoot") }}</span>
        </div>
      </section>
      <p class="v1-core-detail__boundary">{{ t("official.v1.core.detail.boundary") }}</p>
      <CoreFeatureCards :cards="features" icon="/figma-v1/assets/course-detail-desktop-168-1006/imgFrame1.svg" :action="t('official.v1.core.detail.learnMore')" target="/method" />
      <section id="lessons" class="v1-core-detail__lessons" aria-labelledby="detail-lessons-title">
        <h2 id="detail-lessons-title">{{ t("official.v1.core.detail.lessons") }}</h2>
        <details v-for="(step, index) in steps" :key="step">
          <summary><span>{{ String(index + 1).padStart(2, '0') }} {{ t(directionTextKey(direction, step)) }}</span><span aria-hidden="true">⌄</span></summary>
          <p>{{ t(directionTextKey(direction, `${step}Note`)) }}</p>
        </details>
        <p class="v1-core-detail__lessons-note">{{ t("official.v1.core.detail.lessonsNote") }}</p>
      </section>
      <section class="v1-core-detail__path" aria-labelledby="detail-path-title">
        <p class="v1-core-detail__eyebrow">{{ t("official.v1.core.detail.pathEyebrow") }}</p>
        <h2 id="detail-path-title">{{ t("official.v1.core.detail.pathTitle") }}</h2>
        <p>{{ t("official.v1.core.detail.pathLead") }}</p>
        <div class="v1-core-detail__path-columns">
          <div class="v1-core-detail__structure">
            <h3>{{ t("official.v1.core.detail.structure") }}</h3>
            <ol><li v-for="(step, index) in steps" :key="step"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ t(directionTextKey(direction, step)) }}</strong></li></ol>
            <small>{{ t("official.v1.core.detail.structureNote") }}</small>
          </div>
          <div class="v1-core-detail__word-card">
            <span>{{ t("official.v1.core.detail.vocabulary") }}</span>
            <strong>{{ t("official.v1.core.detail.exampleWord") }}</strong>
            <small>{{ t("official.v1.core.detail.exampleMeaning") }}</small>
            <p>{{ t("official.v1.core.detail.exampleFoot") }}</p>
          </div>
        </div>
      </section>
      <NuxtLink class="v1-core-detail__back" to="/courses">← {{ t("official.v1.core.detail.back") }}</NuxtLink>
    </div>
  </div>
</template>
<style scoped>
.v1-core-detail { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-core-detail__container { width: min(1192px, calc(100% - 48px)); margin: auto; padding: 52px 0 40px; }
.v1-core-detail__intro { display: grid; grid-template-columns: minmax(0, 1fr) 359px; gap: 24px; min-height: 295px; padding: 26px 43px 24px 23px; border-radius: 24px; background: var(--v1-brand-soft); }
.v1-core-detail__intro-copy { min-width: 0; }
.v1-core-detail__eyebrow { color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-core-detail__intro h2 { margin-top: 27px; font: 600 37px/1.2 var(--v1-font-display); }
.v1-core-detail__intro-copy > p:not(.v1-core-detail__eyebrow) { margin-top: 25px; color: var(--v1-muted); font-size: 15px; }
.v1-core-detail__intro-copy :deep(.btn) { width: 216px; margin-top: 40px; border-radius: 14px; background: var(--v1-brand); color: var(--v1-on-brand); }
.v1-core-detail__example { min-width: 0; padding: 16px; border-radius: 22px; background: var(--v1-surface); }
.v1-core-detail__example p { padding: 15px 12px; border-radius: 14px; background: var(--v1-brand-soft); color: var(--v1-brand); font: 600 14px/1.3 var(--v1-font-display); }
.v1-core-detail__example strong { display: block; margin: 18px 12px 0; font: 600 41px/1.1 var(--v1-font-display); }
.v1-core-detail__example small { display: block; margin: 5px 12px 0; color: var(--v1-muted); font-size: 14px; }
.v1-core-detail__example span { display: block; margin: 23px 10px 0; padding-top: 12px; border-top: 1px solid var(--v1-border); color: var(--v1-brand); font-size: 13px; }
.v1-core-detail__boundary { margin: 14px 0; color: var(--v1-muted); font-size: 12px; line-height: 1.6; }
.v1-core-detail__lessons { margin-top: 30px; }
.v1-core-detail__lessons h2 { margin-bottom: 16px; font-size: 29px; }
.v1-core-detail__lessons details { margin-top: 12px; border-radius: 14px; background: color-mix(in srgb, var(--v1-brand-soft) 22%, var(--v1-surface)); }
.v1-core-detail__lessons summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 60px; padding: 15px 19px; cursor: pointer; font-size: 16px; font-weight: 500; list-style: none; }
.v1-core-detail__lessons summary::-webkit-details-marker { display: none; }
.v1-core-detail__lessons summary span:last-child { transition: transform .18s; }
.v1-core-detail__lessons details[open] summary span:last-child { transform: rotate(180deg); }
.v1-core-detail__lessons details > p { padding: 0 19px 18px; color: var(--v1-muted); font-size: 14px; }
.v1-core-detail__lessons-note { margin-top: 10px; color: var(--v1-muted); font-size: 12px; }
.v1-core-detail__path { margin-top: 38px; padding: 24px 22px 26px; border-radius: 25px; background: color-mix(in srgb, var(--v1-brand-soft) 25%, var(--v1-surface)); }
.v1-core-detail__path > .v1-core-detail__eyebrow, .v1-core-detail__path > h2, .v1-core-detail__path > p:not(.v1-core-detail__eyebrow) { margin-left: 6px; }
.v1-core-detail__path > h2 { margin-top: 16px; font-size: 29px; }
.v1-core-detail__path > p:not(.v1-core-detail__eyebrow) { margin-top: 10px; color: var(--v1-muted); font-size: 13px; }
.v1-core-detail__path-columns { display: grid; grid-template-columns: 1fr 1.03fr; gap: 18px; margin-top: 27px; }
.v1-core-detail__structure, .v1-core-detail__word-card { min-width: 0; min-height: 243px; padding: 18px; border-radius: 18px; background: var(--v1-surface); }
.v1-core-detail__structure h3 { font-size: 17px; }
.v1-core-detail__structure ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0 0; padding: 0; list-style: none; }
.v1-core-detail__structure li { min-width: 0; min-height: 76px; padding: 8px 12px; border-radius: 12px; background: var(--v1-brand-soft); }
.v1-core-detail__structure li:last-child { background: var(--v1-tint-mint); }
.v1-core-detail__structure li span, .v1-core-detail__structure li strong { display: block; font-size: 13px; }
.v1-core-detail__structure li span { color: var(--v1-brand); font-family: var(--v1-font-display); font-weight: 600; }
.v1-core-detail__structure li strong { margin-top: 12px; }
.v1-core-detail__structure > small { display: block; margin-top: 54px; color: var(--v1-muted); font-size: 12px; }
.v1-core-detail__word-card > span { display: block; width: min(209px, 100%); padding: 7px 12px; border-radius: 12px; background: var(--v1-brand-soft); color: var(--v1-brand); text-align: center; font: 500 13px var(--v1-font-display); }
.v1-core-detail__word-card > strong { display: block; margin-top: 23px; font: 600 34px/1.2 var(--v1-font-display); }
.v1-core-detail__word-card > small { display: block; margin-top: 5px; color: var(--v1-muted); font-size: 13px; }
.v1-core-detail__word-card > p { margin-top: 23px; padding-top: 12px; border-top: 1px solid var(--v1-border); color: var(--v1-brand); font-size: 13px; }
.v1-core-detail__back { display: inline-flex; align-items: center; min-height: 44px; margin-top: 18px; color: var(--v1-brand); font-size: 14px; font-weight: 600; }
.v1-core-detail :is(a, summary):focus-visible { outline-color: var(--v1-focus); }
:global(:root[data-theme="high-contrast"]) .v1-core-detail__structure li { border: 1px solid var(--v1-border); }
@media (max-width: 850px) { .v1-core-detail__intro { grid-template-columns: minmax(0, 1fr) minmax(220px, 35%); } }
@media (max-width: 700px) {
  .v1-core-detail__container { padding-top: 43px; }
  .v1-core-detail__intro { display: block; min-height: 290px; padding: 26px 23px 24px; }
  .v1-core-detail__intro h2 { max-width: 296px; margin-top: 27px; font-size: 23px; }
  .v1-core-detail__intro-copy > p:not(.v1-core-detail__eyebrow) { margin-top: 25px; }
  .v1-core-detail__intro-copy :deep(.btn) { width: min(210px, 100%); margin-top: 34px; }
  .v1-core-detail__example { display: none; }
  .v1-core-detail__lessons h2, .v1-core-detail__path > h2 { font-size: 23px; }
  .v1-core-detail__path { padding: 20px 15px 32px; }
  .v1-core-detail__path > .v1-core-detail__eyebrow, .v1-core-detail__path > h2, .v1-core-detail__path > p:not(.v1-core-detail__eyebrow) { margin-left: 2px; }
  .v1-core-detail__path-columns { grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
  .v1-core-detail__structure, .v1-core-detail__word-card { min-height: 0; padding: 16px; border-radius: 17px; }
  .v1-core-detail__structure ol { gap: 8px; }
  .v1-core-detail__structure li { padding: 8px; }
  .v1-core-detail__structure > small { margin-top: 16px; }
  .v1-core-detail__word-card { min-height: 197px; }
}
@media (prefers-reduced-motion: reduce) { .v1-core-detail__lessons summary span:last-child { transition: none; } }
</style>
