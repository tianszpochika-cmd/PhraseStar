<script setup lang="ts">
import InfoHero from "~/components/v1/info/InfoHero.vue";
import InfoUseful from "~/components/v1/info/InfoUseful.vue";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const desktopAssets = "/figma-v1/assets/status-desktop-168-3008";
const mobileAssets = "/figma-v1/assets/status-mobile-168-3085";
useOfficialSeo({ title: t("official.v1.info.status.seoTitle"), description: t("official.v1.info.status.lead"), path: "/status" });
</script>
<template>
  <div class="v1-info-status">
    <InfoHero :eyebrow="t('official.v1.info.status.eyebrow')" :title="t('official.v1.info.status.title')" :lead="t('official.v1.info.status.lead')" :caption="t('official.v1.info.status.caption')" :card-label="t('official.v1.info.status.cardLabel')" :card-title="t('official.v1.info.status.cardTitle')" :desktop-assets="desktopAssets" :mobile-assets="mobileAssets" variant="status" tone="mint" card-tone="mint" />
    <div class="v1-info-status__body"><div class="v1-info-status__container">
      <section class="v1-info-status__notice" aria-describedby="status-no-realtime">
        <p class="v1-info-status__eyebrow">{{ t("official.v1.info.status.cardLabel") }}</p>
        <span class="v1-info-status__disclaimer">{{ t("official.v1.info.status.disclaimer") }}</span>
        <h2>{{ t("official.v1.info.status.statusTitle") }}</h2>
        <p class="v1-info-status__notice-text">{{ t("official.v1.info.status.statusText") }}</p>
        <span id="status-no-realtime" class="v1-info-status__sr-only">{{ t("official.v1.info.status.noRealtime") }}</span>
        <NuxtLink class="v1-info-status__button" to="/announcements">{{ t("official.v1.info.status.announcements") }}</NuxtLink>
      </section>
      <NuxtLink class="v1-info-status__help" to="/help"><h2>{{ t("official.v1.info.status.helpTitle") }}</h2><p>{{ t("official.v1.info.status.helpText") }}</p></NuxtLink>
      <InfoUseful class="v1-info-status__useful" :eyebrow="t('official.v1.info.status.cardLabel')" :title="t('official.v1.info.status.usefulTitle')" :intro="t('official.v1.info.status.usefulText')" :entries="[t('official.v1.info.status.entry1'), t('official.v1.info.status.entry2'), t('official.v1.info.status.entry3')]" :steps="[t('official.v1.info.status.step1'), t('official.v1.info.status.step2'), t('official.v1.info.status.step3')]" />
    </div></div>
  </div>
</template>
<style scoped>
.v1-info-status { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-info-status p { color: inherit; }
.v1-info-status :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
.v1-info-status__body { padding: 68px 0 40px; background: var(--v1-surface); }
.v1-info-status__container { width: min(1192px, calc(100% - 48px)); margin: 0 auto; }
.v1-info-status__notice { position: relative; display: flex; flex-direction: column; align-items: flex-start; min-height: 330px; padding: 31px 24px 38px; border-radius: 25px; background: var(--v1-brand-soft); }
.v1-info-status__eyebrow { color: var(--v1-brand) !important; font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-status__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.v1-info-status__disclaimer { position: absolute; top: 25px; right: 37px; display: grid; min-width: 311px; min-height: 42px; place-items: center; padding: 5px 12px; border-radius: 14px; background: var(--v1-surface); color: var(--v1-brand); font-size: 13px; font-weight: 500; }
.v1-info-status__notice h2 { margin-top: 38px; font-size: 34px; }
.v1-info-status__notice-text { margin-top: 38px; margin-bottom: 16px; color: var(--v1-muted) !important; font-size: 15px; line-height: 1.6; }
.v1-info-status__button { display: grid; width: 229px; min-height: 52px; place-items: center; margin-top: auto; border-radius: 14px; background: var(--v1-brand); color: var(--v1-on-brand); font-size: 15px; font-weight: 700; }
.v1-info-status__help { display: block; min-height: 163px; margin-top: 26px; padding: 29px 22px; border-radius: 20px; background: var(--v1-field-surface, var(--v1-bg)); }
.v1-info-status__help h2 { font-size: 21px; }
.v1-info-status__help p { margin-top: 19px; color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-info-status__useful { margin-top: 30px; }
html[data-theme="high-contrast"] .v1-info-status__notice, html[data-theme="high-contrast"] .v1-info-status__help { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-status__body { padding-top: 50px; }
 .v1-info-status__notice { min-height: 330px; }
 .v1-info-status__disclaimer { top: 25px; right: 24px; min-width: 0; padding: 4px 12px; font-size: 11px; }
 .v1-info-status__notice h2 { margin-top: 38px; font-size: 23px; }
 .v1-info-status__notice-text { margin-top: 54px; font-size: 15px; }
 .v1-info-status__button { width: min(239px, 100%); }
 .v1-info-status__help { min-height: 147px; }
}
@media (max-width: 360px) {
 .v1-info-status__disclaimer { position: static; width: fit-content; margin: 15px 0 0; }
 .v1-info-status__notice h2 { margin-top: 20px; }
}
</style>
