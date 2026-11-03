<script setup lang="ts">
defineProps<{ morning: boolean }>();
const { t } = useSiteText();
</script>

<template>
  <div class="v1-world-scene" :class="{ 'is-morning': morning }" aria-hidden="true">
    <picture class="scene-depth"><source media="(max-width: 768px)" srcset="/figma-v1/assets/world-mobile-168-1389/imgV4DepthAndStarlight.svg" /><img src="/figma-v1/assets/world-desktop-168-1223/imgV4DepthAndStarlight.svg" alt="" /></picture>
    <div class="scene-window"></div><div class="scene-sky"></div>
    <picture class="scene-moon"><source media="(max-width: 768px)" srcset="/figma-v1/assets/world-mobile-168-1389/imgMoon.svg" /><img src="/figma-v1/assets/world-desktop-168-1223/imgMoon.svg" alt="" /></picture>
    <img class="scene-star-one scene-desktop" src="/figma-v1/assets/world-desktop-168-1223/imgNightStar1.svg" alt="" />
    <img class="scene-star-two scene-desktop" src="/figma-v1/assets/world-desktop-168-1223/imgNightStar2.svg" alt="" />
    <div class="scene-divider"></div><div class="scene-sill"></div>
    <div class="scene-lamp-stem scene-desktop"></div><div class="scene-lamp-head scene-desktop"></div>
    <div class="scene-desk"></div><div class="scene-leg-left"></div><div class="scene-leg-right"></div>
    <div class="scene-laptop"></div><div class="scene-display"></div>
    <div class="scene-line scene-line-one"></div><div class="scene-line scene-line-two"></div><div class="scene-line scene-line-three"></div>
    <div class="scene-keyboard"></div><div class="scene-book-one"></div><div class="scene-book-two"></div><div class="scene-book-three scene-desktop"></div>
    <div class="scene-pot scene-desktop"></div>
    <img class="scene-leaf-one scene-desktop" src="/figma-v1/assets/world-desktop-168-1223/imgPlantLeaf1.svg" alt="" />
    <img class="scene-leaf-two scene-desktop" src="/figma-v1/assets/world-desktop-168-1223/imgPlantLeaf2.svg" alt="" />
    <img class="scene-leaf-three scene-desktop" src="/figma-v1/assets/world-desktop-168-1223/imgPlantLeaf3.svg" alt="" />
    <div class="scene-cup scene-mobile"></div><img class="scene-coffee scene-mobile" src="/figma-v1/assets/world-mobile-168-1389/imgCoffeeTop.svg" alt="" />
    <span class="scene-label">{{ t(morning ? "official.v1.experience.world.morningScene" : "official.v1.experience.world.nightScene") }}</span>
  </div>
</template>

<style scoped>
.v1-world-scene { position: relative; height: 243px; overflow: hidden; border-radius: 23px; background: var(--v1-scene-surface, var(--v1-brand-strong)); }
.v1-world-scene > div,.v1-world-scene > img,.v1-world-scene > picture,.scene-label { position: absolute; }
.v1-world-scene img { display: block; max-width: none; }
.scene-depth { top: 0; left: 0; }
.scene-window { left: 3.58%; top: 25px; width: 26.36%; height: 160px; border-radius: 22px; background: var(--v1-scene-bg, var(--v1-text)); }
.scene-sky { left: 4.61%; top: 36px; width: 24.39%; height: 138px; border-radius: 16px; background: color-mix(in srgb,var(--v1-scene-surface, var(--v1-brand-strong)) 84%,var(--v1-scene-bg, var(--v1-text))); }
.scene-moon { left: 9.13%; top: 61px; }
.scene-star-one { left: 22.03%; top: 70px; }
.scene-star-two { left: 19.59%; top: 116px; }
.scene-divider { left: 16.67%; top: 36px; width: 4px; height: 138px; border-radius: 1px; background: var(--v1-scene-detail, var(--v1-brand-soft)); opacity: .75; }
.scene-sill { left: 2.92%; top: 174px; width: 27.68%; height: 10px; border-radius: 4px; background: var(--v1-scene-detail, var(--v1-brand-soft)); }
.scene-lamp-stem { left: 38.61%; top: 80px; width: 9px; height: 93px; background: var(--v1-scene-detail, var(--v1-brand-soft)); }
.scene-lamp-head { left: 36.16%; top: 62px; width: 61px; height: 22px; border-radius: 11px; background: var(--v1-scene-warm, var(--v1-scene-detail)); }
.scene-desk { left: 34.84%; top: 176px; width: 58.95%; height: 15px; border-radius: 6px; background: var(--v1-scene-detail, var(--v1-brand-soft)); }
.scene-leg-left,.scene-leg-right { top: 191px; width: 10px; height: 41px; border-radius: 4px; background: var(--v1-scene-detail, var(--v1-brand-soft)); opacity: .75; }
.scene-leg-left { left: 39.17%; }.scene-leg-right { left: 87.38%; }
.scene-laptop { left: 51.6%; top: 63px; width: 18.45%; height: 110px; border-radius: 13px; background: color-mix(in srgb,var(--v1-scene-detail, var(--v1-brand-soft)) 85%,var(--v1-scene-surface, var(--v1-brand))); }
.scene-display { left: 52.64%; top: 73px; width: 16.48%; height: 92px; border-radius: 8px; background: var(--v1-scene-surface, var(--v1-brand-strong)); }
.scene-line { left: 54.61%; height: 6px; border-radius: 3px; background: var(--v1-scene-detail, var(--v1-brand-soft)); opacity: .8; }
.scene-line-one { top: 97px; width: 11.11%; }.scene-line-two { top: 117px; width: 9.04%; }.scene-line-three { top: 137px; width: 6.97%; }
.scene-keyboard { left: 49.91%; top: 171px; width: 21.75%; height: 12px; border-radius: 5px; background: var(--v1-scene-warm, var(--v1-scene-detail)); }
.scene-book-one,.scene-book-two,.scene-book-three { height: 11px; border-radius: 3px; }
.scene-book-one { left: 75.7%; top: 132px; width: 6.78%; background: var(--v1-scene-warm, var(--v1-scene-detail)); }.scene-book-two { left: 76.37%; top: 144px; width: 7.63%; background: var(--room-book); }.scene-book-three { left: 75.42%; top: 155px; width: 8.48%; background: var(--v1-scene-detail, var(--v1-brand-soft)); }
.scene-pot { left: 88.89%; top: 136px; width: 40px; height: 44px; border-radius: 7px; background: var(--v1-scene-pot, var(--v1-scene-detail)); }
.scene-leaf-one { left: 87.57%; top: 92px; }.scene-leaf-two { left: 89.55%; top: 75px; }.scene-leaf-three { left: 91.24%; top: 98px; }
.scene-label { left: 32.96%; top: 23px; color: var(--v1-scene-text, var(--v1-on-brand)); font-size: 17px; font-weight: 700; }
.scene-mobile { display: none !important; }
.is-morning .scene-sky { background: color-mix(in srgb,var(--v1-scene-surface, var(--v1-brand-strong)) 60%,var(--v1-scene-detail, var(--v1-brand-soft))); }
.is-morning .scene-moon,.is-morning .scene-star-one,.is-morning .scene-star-two { display: none; }
@media (max-width: 768px) {
  .v1-world-scene { height: 166px; }
  .scene-desktop { display: none !important; }.scene-mobile { display: block !important; }
  .scene-window { left: 5%; top: 18px; width: 37.4%; height: 89px; border-radius: 12px; }
  .scene-sky { left: 7%; top: 24px; width: 33.4%; height: 76px; border-radius: 9px; }
  .scene-moon { left: 12.9%; top: 34px; }
  .scene-divider { left: 23.5%; top: 24px; width: 3px; height: 77px; }
  .scene-sill { left: 5.6%; top: 101px; width: 36.8%; height: 6px; }
  .scene-desk { left: 46.7%; top: 116px; width: 47%; height: 9px; }
  .scene-leg-left,.scene-leg-right { top: 125px; width: 7px; height: 26px; }.scene-leg-left { left: 52.6%; }.scene-leg-right { left: 88.1%; }
  .scene-laptop { left: 52.3%; top: 49px; width: 29.1%; height: 62px; border-radius: 9px; }
  .scene-display { left: 54.6%; top: 56px; width: 24.5%; height: 46px; border-radius: 5px; }
  .scene-line { left: 59.9%; height: 4px; }.scene-line-one { top: 66px; width: 13.9%; }.scene-line-two { top: 77px; width: 8.9%; }.scene-line-three { top: 88px; width: 11.9%; }
  .scene-keyboard { left: 49%; top: 107px; width: 36.1%; height: 7px; }
  .scene-book-one { left: 67.5%; top: 127px; width: 12.6%; height: 6px; }.scene-book-two { left: 66.6%; top: 134px; width: 12.9%; height: 6px; }
  .scene-cup { left: 83.1%; top: 89px; width: 17px; height: 24px; border-radius: 5px; background: var(--v1-scene-pot, var(--v1-scene-detail)); }.scene-coffee { left: 83.1%; top: 88px; }
  .scene-label { left: 5.6%; top: 145px; font-size: 11px; font-weight: 400; }
}
@media (prefers-reduced-motion: reduce) { .v1-world-scene { transition: none; } }
</style>
