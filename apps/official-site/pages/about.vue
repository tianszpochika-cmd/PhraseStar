<script setup lang="ts">
import InfoHero from "~/components/v1/info/InfoHero.vue";
import InfoUseful from "~/components/v1/info/InfoUseful.vue";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const desktopAssets = "/figma-v1/assets/about-desktop-168-2639";
const mobileAssets = "/figma-v1/assets/about-mobile-168-2757";
const values = ["daily", "mastery", "warmth"] as const;
const days = computed(() => t("official.v1.info.about.weekdays").split(" "));
const dots = ["imgEllipse2.svg", "imgEllipse3.svg", "imgEllipse3.svg", "imgEllipse2.svg", "imgEllipse3.svg", "imgEllipse4.svg", "imgEllipse4.svg"];
useOfficialSeo({ title: t("official.v1.info.about.seoTitle"), description: t("official.v1.info.about.lead"), path: "/about" });
</script>
<template>
  <div class="v1-info-about">
    <InfoHero :eyebrow="t('official.v1.info.about.eyebrow')" :title="t('official.v1.info.about.title')" :lead="t('official.v1.info.about.lead')" :caption="t('official.v1.info.about.caption')" :card-label="t('official.v1.info.about.cardLabel')" :card-title="t('official.v1.info.about.cardTitle')" :desktop-assets="desktopAssets" :mobile-assets="mobileAssets" variant="about" tone="rose" />
    <div class="v1-info-about__body"><div class="v1-info-about__container">
      <section class="v1-info-about__story">
        <div class="v1-info-about__story-copy">
          <p class="v1-info-about__eyebrow">{{ t("official.v1.info.about.storyLabel") }}</p>
          <h2>{{ t("official.v1.info.about.storyFirst") }}<br />{{ t("official.v1.info.about.storySecond") }}</h2>
          <p class="v1-info-about__story-text">{{ t("official.v1.info.about.storyText") }}</p>
        </div>
        <div class="v1-info-about__sample" role="img" :aria-label="t('official.v1.info.about.sampleAlt')">
          <div aria-hidden="true">
            <img class="v1-info-about__sample-circle" :src="`${desktopAssets}/imgEllipse1.svg`" alt="" />
            <img class="v1-info-about__sample-icon" :src="`${desktopAssets}/imgFrame.svg`" alt="" />
            <p class="v1-info-about__sample-label">{{ t("official.v1.info.about.sampleLabel") }}</p>
            <strong>{{ t("official.v1.info.about.sampleTitle") }}</strong>
            <div class="v1-info-about__days">
              <div v-for="(day, index) in days" :key="day"><span><img :src="`${desktopAssets}/${dots[index]}`" alt="" /><b v-if="index < 5">✓</b></span><small>{{ day }}</small></div>
            </div>
            <div class="v1-info-about__sample-track"><span></span></div>
          </div>
        </div>
        <div class="v1-info-about__tiny-progress" role="img" :aria-label="t('official.v1.info.about.sampleAlt')"><span></span><b aria-hidden="true">✦</b></div>
      </section>
      <section class="v1-info-about__values" :aria-label="t('official.v1.info.about.cardTitle')">
        <article v-for="(item, index) in values" :key="item">
          <p class="v1-info-about__eyebrow">0{{ index + 1 }}</p>
          <h2>{{ t(`official.v1.info.about.${item}`) }}</h2>
          <p>{{ t(`official.v1.info.about.${item}Text`) }}</p>
        </article>
      </section>
      <section class="v1-info-about__cta"><h2>{{ t("official.v1.info.about.ctaTitle") }}</h2><SiteStartButton :label="t('official.v1.info.about.cta')" :show-icon="false" /></section>
      <InfoUseful class="v1-info-about__useful" :eyebrow="t('official.v1.info.about.usefulLabel')" :title="t('official.v1.info.about.usefulTitle')" :intro="t('official.v1.info.about.usefulText')" :entries="[t('official.v1.info.about.entry1'), t('official.v1.info.about.entry2'), t('official.v1.info.about.entry3')]" :steps="[t('official.v1.info.about.step1'), t('official.v1.info.about.step2'), t('official.v1.info.about.step3')]" />
    </div></div>
  </div>
</template>
<style scoped>
.v1-info-about { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-info-about p { color: inherit; }
.v1-info-about :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
.v1-info-about__body { padding: 68px 0 40px; background: var(--v1-surface); }
.v1-info-about__container { width: min(1192px, calc(100% - 48px)); margin: 0 auto; }
.v1-info-about__story { position: relative; min-height: 365px; overflow: hidden; padding: 33px 26px; border-radius: 26px; background: var(--v1-brand-soft); }
.v1-info-about__story-copy { position: relative; z-index: 1; max-width: 62%; }
.v1-info-about__eyebrow { color: var(--v1-brand) !important; font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-about__story h2 { margin-top: 39px; font-size: 43px; line-height: 64px; }
.v1-info-about__story-text { margin-top: 30px; color: var(--v1-muted) !important; font-size: 15px; }
.v1-info-about__sample { position: absolute; top: 31px; right: 45px; width: 406px; height: 306px; overflow: hidden; padding: 28px; border-radius: 24px; background: var(--v1-surface); }
.v1-info-about__sample img { max-width: none; }
.v1-info-about__sample-circle { position: absolute; top: 9px; right: 19px; width: 139px; height: 139px; }
.v1-info-about__sample-icon { width: 24px; height: 24px; }
.v1-info-about__sample-label { margin-top: 25px; color: var(--v1-brand) !important; font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-about__sample strong { display: block; margin-top: 15px; font-size: 21px; }
.v1-info-about__days { display: flex; gap: 16px; margin-top: 29px; }
.v1-info-about__days > div { width: 36px; text-align: center; }
.v1-info-about__days span { position: relative; display: block; width: 36px; height: 36px; }
.v1-info-about__days img { width: 36px; height: 36px; }
.v1-info-about__days b { position: absolute; inset: 0; display: grid; place-items: center; color: var(--v1-brand); font-size: 16px; }
.v1-info-about__days small { display: block; margin-top: 13px; color: var(--v1-muted); font-size: 12px; }
.v1-info-about__sample-track { height: 7px; margin-top: 24px; overflow: hidden; border-radius: 4px; background: var(--v1-brand-soft); }
.v1-info-about__sample-track span { display: block; width: 71%; height: 100%; border-radius: inherit; background: var(--v1-brand); }
.v1-info-about__tiny-progress { display: none; }
.v1-info-about__values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 29px; }
.v1-info-about__values article { min-height: 158px; padding: 21px 22px; border-radius: 20px; background: var(--v1-tint-mint, var(--v1-brand-soft)); }
.v1-info-about__values article:nth-child(2) { background: var(--v1-info-about-value-sky, var(--v1-tint-sky)); }
.v1-info-about__values article:nth-child(3) { background: var(--v1-info-about-value-rose, var(--v1-tint-rose)); }
.v1-info-about__values h2 { margin-top: 19px; font-size: 21px; }
.v1-info-about__values article > p:last-child { margin-top: 20px; color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-info-about__cta { min-height: 138px; margin-top: 28px; padding: 21px 24px 13px; border-radius: 19px; background: var(--v1-info-about-cta-bg, var(--v1-bg)); }
.v1-info-about__cta h2 { font-size: 22px; }
.v1-info-about__cta :deep(.btn) { min-width: 230px; min-height: 52px; margin-top: 17px; border-radius: 14px; color: var(--v1-on-brand); background: var(--v1-brand); }
.v1-info-about__useful { margin-top: 30px; }
html[data-theme="high-contrast"] .v1-info-about__story,
html[data-theme="high-contrast"] .v1-info-about__sample,
html[data-theme="high-contrast"] .v1-info-about__values article,
html[data-theme="high-contrast"] .v1-info-about__cta { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-about__body { padding-top: 50px; }
 .v1-info-about__story { min-height: 346px; }
 .v1-info-about__story-copy { max-width: none; }
 .v1-info-about__story h2 { margin-top: 39px; font-size: clamp(23px, 7.18vw, 28px); line-height: 1.5; }
 .v1-info-about__story-text { margin-top: 37px; font-size: 15px; line-height: 1.5; }
 .v1-info-about__sample { display: none; }
 .v1-info-about__tiny-progress { position: absolute; left: 20px; right: 20px; bottom: 21px; display: flex; align-items: center; height: 35px; padding: 0 13px; border-radius: 14px; background: var(--v1-surface); }
 .v1-info-about__tiny-progress::before { content: ""; width: 100%; height: 5px; border-radius: 3px; background: var(--v1-brand-soft); }
 .v1-info-about__tiny-progress span { position: absolute; left: 13px; width: 64%; height: 5px; border-radius: 3px; background: var(--v1-brand); }
 .v1-info-about__tiny-progress b { position: absolute; right: 24px; color: var(--v1-brand); font-size: 20px; }
 .v1-info-about__values { grid-template-columns: 1fr; gap: 20px; }
 .v1-info-about__values article { min-height: 148px; }
 .v1-info-about__values article > p:last-child { margin-top: 12px; }
 .v1-info-about__cta :deep(.btn) { min-width: 220px; }
}
</style>
