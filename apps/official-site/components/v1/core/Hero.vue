<script setup lang="ts">
const props = defineProps<{
  variant: "detail" | "method";
  eyebrow: string;
  title: string;
  lead: string;
  artEyebrow: string;
  artTitle: string;
  artCount: string;
  caption: string;
}>();
const desktop = computed(() => `/figma-v1/assets/${props.variant === "detail" ? "course-detail-desktop-168-1006" : "method-desktop-168-1502"}`);
const mobile = computed(() => `/figma-v1/assets/${props.variant === "detail" ? "course-detail-mobile-168-1139" : "method-mobile-168-1637"}`);
</script>
<template>
  <section class="v1-core-hero" :class="`v1-core-hero--${variant}`">
    <div class="v1-core-hero__inner">
      <div class="v1-core-hero__copy">
        <p class="v1-core-hero__eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1><p class="v1-core-hero__lead">{{ lead }}</p>
        <span class="v1-core-hero__mobile-caption" aria-hidden="true">{{ caption }}</span>
        <span class="v1-core-hero__rule" aria-hidden="true" />
      </div>
      <div class="v1-core-hero__art" aria-hidden="true">
        <div class="v1-core-hero__art-card"><div class="v1-core-hero__art-face">
          <img class="v1-core-hero__ellipse" :src="`${desktop}/imgEllipse.svg`" width="158" height="158" alt="" />
          <img class="v1-core-hero__art-icon" :src="`${desktop}/imgFrame.svg`" width="24" height="24" alt="" />
          <span>{{ artEyebrow }}</span><strong>{{ artTitle }}</strong><i /><small>{{ artCount }}</small>
        </div></div>
        <img class="v1-core-hero__orbit" :src="`${desktop}/imgBrandOrbitMotionPath.svg`" width="275" height="275" alt="" />
        <img class="v1-core-hero__orb" :src="`${desktop}/imgAmbientPastelOrb.svg`" width="157" height="157" alt="" />
        <img class="v1-core-hero__glimmer" :src="`${desktop}/imgAmbientGlimmer.svg`" width="18" height="18" alt="" />
        <span class="v1-core-hero__art-caption">{{ caption }}</span><span class="v1-core-hero__mark">{{ variant === 'detail' ? '◈' : '∞' }}</span>
      </div>
      <div class="v1-core-hero__mobile-art" aria-hidden="true">
        <span class="v1-core-hero__mobile-icon"><img :src="`${mobile}/imgFrame.svg`" width="24" height="24" alt="" /></span>
        <img class="v1-core-hero__mobile-ellipse" :src="`${mobile}/imgEllipse.svg`" width="90" height="90" alt="" />
        <img class="v1-core-hero__mobile-orbit" :src="`${mobile}/imgBrandOrbitMotionPath.svg`" width="131" height="131" alt="" />
        <img class="v1-core-hero__mobile-orbit-small" :src="`${mobile}/imgBrandOrbitMotionPath1.svg`" width="95" height="95" alt="" />
        <img class="v1-core-hero__mobile-light" :src="`${mobile}/imgAmbientPastelLight.svg`" width="79" height="79" alt="" />
        <span class="v1-core-hero__mobile-mark">{{ variant === 'detail' ? '◈' : '∞' }}</span>
      </div>
    </div>
  </section>
</template>
<style scoped>
.v1-core-hero { overflow: hidden; color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-core-hero--detail { --v1-core-hero-decor: var(--v1-hero-detail-decor); background: linear-gradient(100deg, var(--v1-hero-detail-from), var(--v1-hero-detail-to)); }
.v1-core-hero--method { --v1-core-hero-decor: var(--v1-hero-method-decor); background: linear-gradient(100deg, var(--v1-hero-method-from), var(--v1-hero-method-to)); }
.v1-core-hero__inner { position: relative; width: min(1192px, calc(100% - 48px)); min-height: 338px; margin-inline: auto; }
.v1-core-hero__copy { position: relative; z-index: 2; padding-top: 32px; }
.v1-core-hero__eyebrow { color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-core-hero h1 { max-width: 750px; margin: 35px 0 36px; font-size: 48px; font-weight: 900; line-height: 1.33; }
.v1-core-hero__lead { color: var(--v1-muted); font-size: 17px; line-height: 31px; }
.v1-core-hero__rule { position: absolute; top: 300px; left: 0; display: block; width: 184px; height: 3px; border-radius: 2px; background: var(--v1-core-hero-decor); opacity: .25; }
.v1-core-hero__art { position: absolute; z-index: 1; top: 0; right: 0; width: 368px; height: 338px; }
.v1-core-hero__art-card { position: absolute; top: 67px; left: -8px; width: 368px; height: 220px; padding: 18px; border-radius: 24px; background: var(--v1-surface); }
.v1-core-hero__art-face { position: relative; height: 184px; padding: 20px 21px; overflow: hidden; border-radius: 19px; background: var(--v1-brand-soft); color: var(--v1-brand); }
.v1-core-hero__art-icon { position: relative; z-index: 1; }
.v1-core-hero__art-face > span { display: block; margin-top: 26px; font: 600 13px/1.2 var(--v1-font-display); }
.v1-core-hero__art-face strong { display: block; margin-top: 8px; color: var(--v1-text); font-size: 23px; }
.v1-core-hero__art-face i { position: relative; display: inline-block; width: 124px; height: 6px; margin-top: 14px; border-radius: 4px; background: var(--v1-surface); }
.v1-core-hero__art-face i::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 84px; border-radius: inherit; background: var(--v1-brand); }
.v1-core-hero__art-face small { position: absolute; left: 165px; bottom: 24px; font-size: 12px; white-space: nowrap; }
.v1-core-hero__ellipse { position: absolute; top: -38px; left: 188px; }
.v1-core-hero__orbit { position: absolute; left: 206px; top: -66px; }
.v1-core-hero__orb { position: absolute; left: 166px; top: 156px; }
.v1-core-hero__glimmer { position: absolute; left: 124px; top: 28px; }
.v1-core-hero__art-caption { position: absolute; top: 261px; left: 19px; color: var(--v1-core-hero-decor); opacity: .23; font: 600 31px/1 var(--v1-font-display); }
.v1-core-hero__mark { position: absolute; top: 183px; left: 371px; width: 79px; color: var(--v1-core-hero-decor); opacity: .32; font-size: 39px; line-height: 1; }
.v1-core-hero__mobile-art, .v1-core-hero__mobile-caption { display: none; }
@media (max-width: 850px) { .v1-core-hero h1 { max-width: 58%; font-size: 38px; } .v1-core-hero__art { transform: scale(.75); transform-origin: right center; } }
@media (max-width: 600px) {
  .v1-core-hero__inner { min-height: 315px; }
  .v1-core-hero__copy { padding-top: 31px; }
  .v1-core-hero h1 { max-width: 342px; margin: 29px 0 0; font-size: 31px; line-height: 45px; }
  .v1-core-hero__lead { position: absolute; top: 189px; left: 0; max-width: 342px; font-size: 14px; line-height: 26px; }
  .v1-core-hero__mobile-caption { position: absolute; top: 263px; left: 1px; display: block; color: var(--v1-core-hero-decor); opacity: .41; font: 600 11px/1 var(--v1-font-display); }
  .v1-core-hero__rule { top: 283px; width: 74px; opacity: .33; }
  .v1-core-hero__art { display: none; }
  .v1-core-hero__mobile-art { position: absolute; top: 0; right: -24px; display: block; width: 150px; height: 315px; }
  .v1-core-hero__mobile-icon { position: absolute; top: 26px; right: 24px; display: grid; place-items: center; width: 54px; height: 54px; border-radius: 17px; background: var(--v1-surface); }
  .v1-core-hero__mobile-ellipse { position: absolute; right: -57px; top: 100px; }
  .v1-core-hero__mobile-orbit { position: absolute; right: -4px; top: 154px; }
  .v1-core-hero__mobile-orbit-small { position: absolute; right: 9px; top: 174px; }
  .v1-core-hero__mobile-light { position: absolute; right: -9px; top: 32px; }
  .v1-core-hero__mobile-mark { position: absolute; left: 66px; top: 59px; width: 48px; color: var(--v1-core-hero-decor); opacity: .65; font-size: 27px; line-height: 1; }
}
</style>
