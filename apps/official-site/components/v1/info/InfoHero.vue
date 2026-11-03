<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  lead: string;
  caption: string;
  cardLabel: string;
  cardTitle: string;
  desktopAssets: string;
  mobileAssets: string;
  tone: "rose" | "sky" | "mint" | "brand" | "sand";
  cardTone?: "rose" | "sky" | "mint" | "brand";
  decor?: "lilac" | "rose" | "sky" | "mint" | "violet" | "sand" | "orchid" | "teal";
}>();
const { t } = useSiteText();
</script>
<template>
  <section class="v1-info-hero" :class="[`v1-info-hero--${tone}`, `v1-info-hero--decor-${decor || tone}`]">
    <div class="v1-info-hero__inner">
      <div class="v1-info-hero__copy">
        <p class="v1-info-hero__eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="v1-info-hero__lead">{{ lead }}</p>
        <span class="v1-info-hero__line" aria-hidden="true"></span>
      </div>
      <div class="v1-info-hero__art" aria-hidden="true">
        <img class="v1-info-hero__glow v1-info-hero__desktop" :src="`${desktopAssets}/imgAtmosphereGlow.svg`" alt="" />
        <img class="v1-info-hero__orbit v1-info-hero__desktop" :src="`${desktopAssets}/imgMotionGentleOrbit.svg`" alt="" />
        <img class="v1-info-hero__orbit-small v1-info-hero__desktop" :src="`${desktopAssets}/imgMotionGentleOrbit1.svg`" alt="" />
        <img class="v1-info-hero__mobile-glow v1-info-hero__mobile" :src="`${mobileAssets}/imgAtmosphereGlow.svg`" alt="" />
        <img class="v1-info-hero__mobile-orbit v1-info-hero__mobile" :src="`${mobileAssets}/imgMotionGentleOrbit.svg`" alt="" />
        <div class="v1-info-hero__card"><div class="v1-info-hero__card-inner" :class="`v1-info-hero__card-inner--${cardTone || 'sky'}`">
          <img class="v1-info-hero__ellipse" :src="`${desktopAssets}/imgEllipse.svg`" alt="" />
          <img class="v1-info-hero__icon v1-info-hero__desktop" :src="`${desktopAssets}/imgFrame.svg`" alt="" />
          <img class="v1-info-hero__icon v1-info-hero__mobile" :src="`${mobileAssets}/imgFrame.svg`" alt="" />
          <p>{{ cardLabel }}</p><strong>{{ cardTitle }}</strong><span>{{ t("official.v1.info.common.openInformation") }}</span>
        </div></div>
        <span class="v1-info-hero__caption">{{ caption }}</span>
      </div>
      <span class="v1-info-hero__mobile-caption" aria-hidden="true">{{ caption }}</span>
    </div>
  </section>
</template>
<style scoped>
.v1-info-hero { --v1-info-decor: var(--v1-decor-lilac, var(--v1-brand)); overflow: hidden; color: var(--v1-text); background: linear-gradient(100deg, var(--v1-tint-rose, var(--v1-brand-soft)), var(--v1-brand-soft)); }
.v1-info-hero--decor-rose { --v1-info-decor: var(--v1-decor-rose, var(--v1-brand)); }
.v1-info-hero--decor-sky { --v1-info-decor: var(--v1-decor-sky, var(--v1-brand)); }
.v1-info-hero--decor-mint { --v1-info-decor: var(--v1-decor-mint, var(--v1-brand)); }
.v1-info-hero--decor-violet { --v1-info-decor: var(--v1-decor-violet, var(--v1-brand)); }
.v1-info-hero--decor-sand { --v1-info-decor: var(--v1-decor-sand, var(--v1-brand)); }
.v1-info-hero--decor-orchid { --v1-info-decor: var(--v1-decor-orchid, var(--v1-brand)); }
.v1-info-hero--decor-teal { --v1-info-decor: var(--v1-decor-teal, var(--v1-brand)); }
.v1-info-hero--sky { background: linear-gradient(100deg, var(--v1-tint-sky, var(--v1-brand-soft)), var(--v1-tint-mint, var(--v1-brand-soft))); }
.v1-info-hero--mint { background: linear-gradient(100deg, var(--v1-tint-mint, var(--v1-brand-soft)), var(--v1-tint-sky, var(--v1-brand-soft))); }
.v1-info-hero--brand { background: linear-gradient(100deg, var(--v1-brand-soft), var(--v1-tint-sky, var(--v1-brand-soft))); }
.v1-info-hero--sand { background: linear-gradient(100deg, var(--v1-tint-sand, var(--v1-bg)), var(--v1-tint-sky, var(--v1-brand-soft))); }
.v1-info-hero__inner { position: relative; width: min(1192px, calc(100% - 48px)); height: 319px; margin: 0 auto; }
.v1-info-hero__copy { position: relative; z-index: 1; padding-top: 30px; }
.v1-info-hero__eyebrow { color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-hero h1 { margin: 45px 0 0; color: var(--v1-text); font: 900 46px/65px var(--v1-font-sans); }
.v1-info-hero__lead { margin-top: 32px; color: var(--v1-muted); font: 400 17px/29px var(--v1-font-sans); }
.v1-info-hero__line { display: block; width: 180px; height: 4px; margin-top: 77px; border-radius: 2px; background: color-mix(in srgb, var(--v1-info-decor) 27%, transparent); }
.v1-info-hero__art { position: absolute; inset: 0 0 0 auto; width: 420px; }
.v1-info-hero__art img { max-width: none; }
.v1-info-hero__glow { position: absolute; right: 29px; top: 48px; width: 200px; height: 200px; }
.v1-info-hero__orbit { position: absolute; right: -77px; top: 11px; width: 277px; height: 277px; }
.v1-info-hero__orbit-small { position: absolute; right: -12px; top: 55px; width: 165px; height: 165px; }
.v1-info-hero__card { position: absolute; right: 9px; top: 70px; width: 371px; height: 204px; padding: 15px; border-radius: 23px; background: var(--v1-surface); }
.v1-info-hero__card-inner { position: relative; height: 174px; overflow: hidden; padding: 22px; border-radius: 18px; background: var(--v1-tint-sky, var(--v1-brand-soft)); }
.v1-info-hero__card-inner--rose { background: var(--v1-tint-rose, var(--v1-brand-soft)); }
.v1-info-hero__card-inner--mint { background: var(--v1-tint-mint, var(--v1-brand-soft)); }
.v1-info-hero__card-inner--brand { background: var(--v1-brand-soft); }
.v1-info-hero__ellipse { position: absolute; right: -30px; top: -30px; width: 131px; height: 131px; }
.v1-info-hero__icon { position: relative; width: 24px; height: 24px; }
.v1-info-hero__card p { position: relative; margin: 23px 0 0; color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-hero__card strong { position: relative; display: block; margin-top: 12px; font-size: 24px; line-height: 1.35; }
.v1-info-hero__card span { display: block; margin-top: 11px; color: var(--v1-muted); font: 600 11px/1.3 var(--v1-font-display); }
.v1-info-hero__caption { position: absolute; top: 269px; left: 94px; width: 401px; color: color-mix(in srgb, var(--v1-info-decor) 39%, transparent); font: 600 23px/1 var(--v1-font-display); }
.v1-info-hero__mobile, .v1-info-hero__mobile-caption { display: none; }
@media (max-width: 800px) {
 .v1-info-hero__inner { height: 300px; }
 .v1-info-hero__copy { padding-top: 33px; }
 .v1-info-hero h1 { margin-top: 29px; font-size: 31px; line-height: 44px; }
 .v1-info-hero__lead { margin-top: 59px; font-size: 14px; line-height: 24px; }
 .v1-info-hero__line { position: absolute; top: 286px; left: 0; width: 78px; height: 3px; margin: 0; background: color-mix(in srgb, var(--v1-info-decor) 45%, transparent); }
 .v1-info-hero__art { width: 180px; right: -24px; }
 .v1-info-hero__desktop, .v1-info-hero__ellipse { display: none; }
 .v1-info-hero__mobile { display: block; }
 .v1-info-hero__mobile-glow { position: absolute; right: -16px; top: 45px; width: 110px; height: 110px; }
 .v1-info-hero__mobile-orbit { position: absolute; right: 10px; top: 58px; width: 89px; height: 89px; }
 .v1-info-hero__card { top: 27px; right: 23px; width: 54px; height: 54px; padding: 15px; border-radius: 16px; }
 .v1-info-hero__card-inner { height: 24px; padding: 0; border-radius: 0; background: transparent; }
 .v1-info-hero__card p, .v1-info-hero__card strong, .v1-info-hero__card span, .v1-info-hero__caption { display: none; }
 .v1-info-hero__mobile-caption { display: block; position: absolute; left: 0; bottom: 24px; color: color-mix(in srgb, var(--v1-info-decor) 45%, transparent); font: 600 11px/1 var(--v1-font-display); }
}
</style>
