<script setup lang="ts">
import InfoHero from "./InfoHero.vue";
import InfoUseful from "./InfoUseful.vue";
import { useOfficialSeo } from "~/utils/seo";
type LegalKind = "privacy" | "terms" | "minors" | "compliance";
const props = defineProps<{ kind: LegalKind }>();
const { t } = useSiteText();
const pages = {
  privacy: { desktop: "privacy-desktop-168-3140", mobile: "privacy-mobile-168-3249", tone: "brand", cardTone: "rose", decor: "violet" },
  terms: { desktop: "terms-desktop-168-3317", mobile: "terms-mobile-168-3426", tone: "sand", cardTone: "sky", decor: "sand" },
  minors: { desktop: "minors-desktop-168-3494", mobile: "minors-mobile-168-3603", tone: "rose", cardTone: "mint", decor: "orchid" },
  compliance: { desktop: "compliance-desktop-168-3671", mobile: "compliance-mobile-168-3786", tone: "mint", cardTone: "mint", decor: "teal" },
} as const;
const config = computed(() => pages[props.kind]);
const desktopAssets = computed(() => `/figma-v1/assets/${config.value.desktop}`);
const mobileAssets = computed(() => `/figma-v1/assets/${config.value.mobile}`);
const key = (suffix: string) => `official.v1.info.legal.${props.kind}.${suffix}`;
const links: { kind: LegalKind; path: string; label: string }[] = [
  { kind: "privacy", path: "/privacy", label: "official.v1.info.legal.navPrivacy" },
  { kind: "terms", path: "/terms", label: "official.v1.info.legal.navTerms" },
  { kind: "minors", path: "/minors", label: "official.v1.info.legal.navMinors" },
  { kind: "compliance", path: "/compliance", label: "official.v1.info.legal.navCompliance" },
];
const entries = computed(() => [1, 2, 3].map((n) => t(key(`entry${n}`))));
const steps = computed(() => [1, 2, 3].map((n) => t(key(`step${n}`))));
useOfficialSeo({ title: t(key("seoTitle")), description: t(key("lead")), path: `/${props.kind}` });
</script>
<template>
  <div class="v1-info-legal">
    <InfoHero :eyebrow="t(key('eyebrow'))" :title="t(key('title'))" :lead="t(key('lead'))" :caption="t(key('caption'))" :card-label="t(key('cardLabel'))" :card-title="t(key('cardTitle'))" :desktop-assets="desktopAssets" :mobile-assets="mobileAssets" :tone="config.tone" :card-tone="config.cardTone" :decor="config.decor" />
    <div class="v1-info-legal__body"><div class="v1-info-legal__container">
      <nav class="v1-info-legal__nav" :aria-label="t('official.v1.info.legal.navigation')">
        <NuxtLink v-for="link in links" :key="link.kind" :to="link.path" :aria-current="kind === link.kind ? 'page' : undefined">{{ t(link.label) }}</NuxtLink>
      </nav>
      <article class="v1-info-legal__document">
        <h2>{{ t(key("title")) }}</h2>
        <p class="v1-info-legal__document-label">{{ t("official.v1.info.legal.documentLabel") }}</p>
        <div class="v1-info-legal__mobile-rule" aria-hidden="true"><span></span></div>
        <div class="v1-info-legal__grid">
          <div class="v1-info-legal__chapters">
            <section v-for="n in [1, 2, 3]" :id="`legal-section-${n}`" :key="n" class="v1-info-legal__chapter">
              <h3>0{{ n }}&nbsp; {{ t(key(`section${n}`)) }}</h3>
              <p>{{ t(key(`content${n}`)) }}</p>
            </section>
            <p class="v1-info-legal__notice">{{ t(key("notice")) }}</p>
          </div>
          <aside class="v1-info-legal__contents" :aria-label="t('official.v1.info.legal.contents')">
            <div class="v1-info-legal__contents-title"><img :src="`${desktopAssets}/imgFrame1.svg`" alt="" /><h3>{{ t("official.v1.info.legal.contents") }}</h3></div>
            <p class="v1-info-legal__contents-label">{{ t("official.v1.info.legal.contentsLabel") }}</p>
            <a v-for="n in [1, 2, 3]" :key="n" :href="`#legal-section-${n}`"><span>0{{ n }}</span><strong>{{ t(key(`short${n}`)) }}<small>{{ t("official.v1.info.legal.chapter") }}</small></strong></a>
            <div class="v1-info-legal__reading"><div><img :src="`${desktopAssets}/imgFrame.svg`" alt="" /><h3>{{ t("official.v1.info.legal.readingTitle") }}</h3></div><p>{{ t("official.v1.info.legal.reading1") }}<br />{{ t("official.v1.info.legal.reading2") }}</p></div>
          </aside>
        </div>
      </article>
      <slot name="after-document" />
      <InfoUseful class="v1-info-legal__useful" :eyebrow="t(key('usefulLabel'))" :title="t(key('usefulTitle'))" :intro="t(key('usefulText'))" :entries="entries" :steps="steps" />
    </div></div>
  </div>
</template>
<style scoped>
.v1-info-legal { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-info-legal p { color: inherit; }
.v1-info-legal :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
.v1-info-legal__body { padding: 68px 0 40px; background: var(--v1-surface); }
.v1-info-legal__container { width: min(1192px, calc(100% - 48px)); margin: 0 auto; }
.v1-info-legal__nav { display: flex; gap: 15px; }
.v1-info-legal__nav a { display: grid; width: 157px; min-height: 43px; place-items: center; padding: 6px; border-radius: 15px; background: var(--v1-brand-soft); color: var(--v1-brand); font-size: 13px; font-weight: 500; }
.v1-info-legal__nav a[aria-current="page"] { color: var(--v1-on-brand); background: var(--v1-brand); }
.v1-info-legal__document { min-height: 660px; margin-top: 40px; padding: 31px 24px 17px; border-radius: 22px; background: var(--v1-surface); }
.v1-info-legal__document > h2 { font-size: 35px; }
.v1-info-legal__document-label { margin-top: 16px; color: var(--v1-brand) !important; font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-legal__mobile-rule { display: none; }
.v1-info-legal__grid { display: grid; grid-template-columns: minmax(0, 735fr) minmax(260px, 328fr); gap: 62px; margin-top: 30px; align-items: start; }
.v1-info-legal__chapter { min-height: 116px; padding: 0 0 20px; border-bottom: 1px solid var(--v1-border); scroll-margin-top: 100px; }
.v1-info-legal__chapter + .v1-info-legal__chapter { padding-top: 16px; }
.v1-info-legal__chapter h3 { font-size: 21px; }
.v1-info-legal__chapter p { margin-top: 14px; color: var(--v1-muted); font-size: 15px; line-height: 26px; }
.v1-info-legal__notice { min-height: 82px; margin-top: 37px; padding: 20px 14px; border-radius: 14px; background: var(--v1-brand-soft); color: var(--v1-brand) !important; font-size: 13px; }
.v1-info-legal__contents { min-height: 510px; padding: 24px 17px 18px; border-radius: 22px; background: color-mix(in srgb, var(--v1-brand-soft) 45%, var(--v1-bg)); }
.v1-info-legal__contents-title, .v1-info-legal__reading > div { display: flex; align-items: center; gap: 15px; }
.v1-info-legal__contents-title { padding-left: 6px; }
.v1-info-legal__contents-title img, .v1-info-legal__reading img { width: 24px; height: 24px; max-width: none; }
.v1-info-legal__contents-title h3 { font-size: 20px; }
.v1-info-legal__contents-label { margin: 20px 6px 13px; color: var(--v1-brand) !important; font: 600 12px/1.3 var(--v1-font-display); }
.v1-info-legal__contents > a { display: flex; align-items: center; gap: 12px; min-height: 58px; margin-top: 8px; padding: 6px 17px; border-radius: 15px; background: var(--v1-surface); }
.v1-info-legal__contents > a span { width: 35px; color: var(--v1-brand); font: 600 17px/1 var(--v1-font-display); }
.v1-info-legal__contents > a strong { display: block; font-size: 16px; line-height: 1.2; }
.v1-info-legal__contents > a small { display: block; color: var(--v1-muted); font-size: 12px; font-weight: 400; }
.v1-info-legal__reading { min-height: 167px; margin-top: 21px; padding: 16px 15px; border-radius: 16px; background: var(--v1-brand-soft); }
.v1-info-legal__reading h3 { font-size: 16px; }
.v1-info-legal__reading p { margin-top: 17px; color: var(--v1-muted); font-size: 13px; line-height: 1.6; }
.v1-info-legal__useful { margin-top: 27px; }
:global(html[data-theme="high-contrast"]) .v1-info-legal__nav a,
:global(html[data-theme="high-contrast"]) .v1-info-legal__document,
:global(html[data-theme="high-contrast"]) .v1-info-legal__notice,
:global(html[data-theme="high-contrast"]) .v1-info-legal__contents { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-legal__body { padding-top: 50px; }
 .v1-info-legal__nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
 .v1-info-legal__nav a { width: auto; white-space: nowrap; font-size: 12px; }
 .v1-info-legal__document { min-height: 682px; padding: 31px 24px 34px; }
 .v1-info-legal__document > h2 { font-size: 26px; }
 .v1-info-legal__document-label { margin-top: 16px; }
 .v1-info-legal__mobile-rule { display: block; height: 8px; margin: 19px -4px 0; border-radius: 4px; background: var(--v1-brand-soft); }
 .v1-info-legal__mobile-rule span { display: block; width: 41%; height: 100%; border-radius: inherit; background: var(--v1-brand); }
 .v1-info-legal__grid { display: block; margin-top: 16px; }
 .v1-info-legal__chapter { position: relative; min-height: 135px; }
 .v1-info-legal__chapter::before { content: ""; position: absolute; top: 5px; left: -7px; width: 3px; height: 30px; border-radius: 2px; background: var(--v1-brand); }
 .v1-info-legal__chapter + .v1-info-legal__chapter { padding-top: 16px; }
 .v1-info-legal__chapter + .v1-info-legal__chapter::before { top: 21px; }
 .v1-info-legal__chapter h3 { font-size: 18px; }
 .v1-info-legal__chapter p { margin-top: 12px; font-size: 14px; line-height: 23px; }
 .v1-info-legal__notice { margin-top: 21px; }
 .v1-info-legal__contents { display: none; }
}
</style>
