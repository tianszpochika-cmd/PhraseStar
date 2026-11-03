<script setup lang="ts">
const { t } = useSiteText();
const desktop = '/figma-v1/assets/home-desktop-168-74/';
const mobile = '/figma-v1/assets/home-mobile-168-409/';
const items = [
  { number: 1, deskIcon: 'imgFrame12.svg', mobileIcon: 'imgFrame6.svg' },
  { number: 2, deskIcon: 'imgFrame13.svg', mobileIcon: 'imgFrame7.svg' },
  { number: 3, deskIcon: 'imgFrame14.svg', mobileIcon: 'imgFrame8.svg' },
];
</script>
<template>
  <div class="promise-section">
    <div class="promise-inner">
      <div v-for="item in items" :key="item.number" class="promise-item">
        <img class="desktop-only" :src="desktop + item.deskIcon" alt="" /><img class="mobile-only" :src="mobile + item.mobileIcon" alt="" />
        <span class="desktop-only"><strong>{{ t(`official.v1.home.promise.desktop${item.number}`) }}</strong><small>{{ t(`official.v1.home.promise.desktop${item.number}Detail`) }}</small></span>
        <span class="mobile-only"><strong>{{ t(`official.v1.home.promise.mobile${item.number}`) }}</strong><small>{{ t(`official.v1.home.promise.mobile${item.number}Detail`) }}</small></span>
      </div>
    </div>
  </div>
  <div class="ribbon"><div class="ribbon-inner"><strong class="desktop-only">{{ t('official.v1.home.promise.ribbonDesktop') }}</strong><strong class="mobile-only">{{ t('official.v1.home.promise.ribbonMobile') }}</strong><small class="desktop-only">{{ t('official.v1.home.promise.ribbonCaption') }}</small><img class="ribbon-star desktop-only" :src="desktop + 'imgFrame15.svg'" alt="" /><img class="ribbon-star mobile-only" :src="mobile + 'imgStarlightMotionTwinkle2.svg'" alt="" /></div></div>
</template>
<style scoped>
.promise-section { min-height: 142px; background: var(--v1-surface); }.promise-inner { position: relative; top: 27px; display: grid; grid-template-columns: repeat(3, 1fr); max-width: 1192px; height: 115px; align-items: center; margin: auto; border-top: 1px solid var(--v1-border); }.promise-item { display: flex; align-items: center; gap: 15px; padding-left: 24px; }.promise-item img { flex: none; }.promise-item strong, .promise-item small { display: block; }.promise-item strong { font-size: 16px; }.promise-item small { color: var(--v1-muted); font-size: 13px; }@media (min-width: 701px) { .mobile-only { display: none !important; } }.ribbon { background: var(--v1-home-ribbon-desktop); }.ribbon-inner { position: relative; max-width: 1192px; height: 116px; margin: auto; color: var(--v1-brand); }.ribbon strong { display: block; padding-top: 12px; white-space: pre-wrap; font: 600 51px/1.35 var(--v1-font-display); opacity: .88; }.ribbon small { display: block; font: 600 12px/1.2 var(--v1-font-display); opacity: .85; }.ribbon-star { position: absolute; right: -58px; top: 31px; }
html[data-theme="high-contrast"] .promise-item { outline: 1px solid var(--v1-border); outline-offset: -1px; }
@media (max-width: 1250px) { .promise-inner, .ribbon-inner { margin-inline: 24px; }.ribbon-star { right: 0; } }
@media (max-width: 700px) { .ribbon { background: var(--v1-home-ribbon-mobile); } .desktop-only { display: none !important; }.promise-inner { position: static; height: 243px; grid-template-columns: 1fr; gap: 10px; align-content: start; margin-inline: 24px; padding: 25px 0 12px; border: 0; }.promise-item { height: 62px; gap: 13px; padding: 0 16px; border-radius: 14px; background: var(--v1-bg); }.promise-item strong { font-size: 15px; line-height: 23px; }.promise-item small { font-size: 11px; line-height: 17px; }.ribbon-inner { height: 85px; }.ribbon-inner::after { position: absolute; right: 0; bottom: 16px; left: 0; height: 2px; border-radius: 2px; background: var(--v1-home-ribbon-line); content: ''; }.ribbon strong { padding-top: 14px; font-size: 32px; line-height: 43px; opacity: .85; }.ribbon-star { top: 28px; right: 4px; } }
</style>
