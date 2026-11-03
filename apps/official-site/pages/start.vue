<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";

const { t } = useSiteText();
const config = useRuntimeConfig();
const { registerLink, authLink } = useOfficialSiteLinks();
const deviceDialogOpen = ref(false);
const copyState = ref("");
const selectedDuration = ref(15);
const siteAddress = computed(() => `${String(config.public.siteUrl).replace(/\/$/, "")}/start`);
const durations = [5, 15, 30, 45] as const;
const cards = [
  { key: "plan", href: "/method" },
  { key: "record", href: "/help" },
  { key: "review", href: "/method" },
] as const;
let copyAttempt = 0;

function openDeviceOptions() {
  copyAttempt += 1;
  copyState.value = "";
  deviceDialogOpen.value = true;
}
function closeDeviceOptions() {
  copyAttempt += 1;
  deviceDialogOpen.value = false;
}
function selectAddress(event: FocusEvent) {
  (event.target as HTMLInputElement).select();
}
async function copy() {
  const attempt = ++copyAttempt;
  copyState.value = "";
  try {
    await navigator.clipboard.writeText(siteAddress.value);
    if (deviceDialogOpen.value && attempt === copyAttempt) copyState.value = t("official.v1.experience.start.copySuccess");
  } catch {
    if (deviceDialogOpen.value && attempt === copyAttempt) copyState.value = t("official.v1.experience.start.copyFailure");
  }
}
useOfficialSeo({
  title: t("official.v1.experience.start.seoTitle"),
  description: t("official.v1.experience.start.seoDescription"),
  path: "/start",
});
</script>

<template>
  <div class="v1-start">
    <PageHeading
      class="v1-start-heading"
      :title="t('official.v1.experience.start.title')"
      :lead="t('official.v1.experience.start.lead')"
      :label="t('official.v1.experience.start.label')"
      :show-breadcrumb="false"
    >
      <template #artwork>
        <div class="v1-start-heading-card" aria-hidden="true">
          <img class="v1-start-card-ellipse" src="/figma-v1/assets/start-desktop-168-1723/imgEllipse.svg" alt="" />
          <picture class="v1-start-heading-icon"><source media="(max-width: 768px)" srcset="/figma-v1/assets/start-mobile-168-1872/imgFrame.svg" /><img src="/figma-v1/assets/start-desktop-168-1723/imgFrame.svg" alt="" /></picture>
          <span>{{ t("official.v1.experience.start.heroEyebrow") }}</span>
          <strong>{{ t("official.v1.experience.start.heroTitle") }}</strong>
          <div class="v1-start-progress"><i /></div>
          <small>{{ t("official.v1.experience.start.heroDevice") }}</small>
        </div>
        <div class="v1-start-heading-ambient" aria-hidden="true">
          <img class="v1-start-orbit v1-start-desktop-art" src="/figma-v1/assets/start-desktop-168-1723/imgBrandOrbitMotionPath.svg" alt="" />
          <img class="v1-start-orb v1-start-desktop-art" src="/figma-v1/assets/start-desktop-168-1723/imgAmbientPastelOrb.svg" alt="" />
          <img class="v1-start-glimmer v1-start-desktop-art" src="/figma-v1/assets/start-desktop-168-1723/imgAmbientGlimmer.svg" alt="" />
          <img class="v1-start-orbit-mobile v1-start-mobile-art" src="/figma-v1/assets/start-mobile-168-1872/imgBrandOrbitMotionPath.svg" alt="" />
          <img class="v1-start-orbit-mobile-inner v1-start-mobile-art" src="/figma-v1/assets/start-mobile-168-1872/imgBrandOrbitMotionPath1.svg" alt="" />
          <img class="v1-start-light-mobile v1-start-mobile-art" src="/figma-v1/assets/start-mobile-168-1872/imgAmbientPastelLight.svg" alt="" />
          <img class="v1-start-ellipse-mobile v1-start-mobile-art" src="/figma-v1/assets/start-mobile-168-1872/imgEllipse.svg" alt="" />
        </div>
        <span class="v1-start-heading-word" aria-hidden="true">{{ t("official.v1.experience.start.heroWordmark") }}</span>
        <span class="v1-start-heading-spark" aria-hidden="true">{{ t("official.v1.experience.start.heroGlimmer") }}</span>
        <span class="v1-start-heading-bar" aria-hidden="true"></span>
      </template>
    </PageHeading>

    <div class="container v1-start-content">
      <section class="v1-start-journey" aria-labelledby="start-journey-title">
        <div class="v1-start-journey-copy">
          <p class="v1-start-eyebrow">{{ t("official.v1.experience.start.journeyLabel") }}</p>
          <h2 id="start-journey-title">{{ t("official.v1.experience.start.journeyTitle") }}</h2>
          <p>{{ t("official.v1.experience.start.journeyDescription") }}</p>
          <div class="v1-start-actions">
            <NuxtLink :to="registerLink()" external class="btn btn-primary" data-register-entry data-primary>{{ t("official.v1.experience.start.register") }}</NuxtLink>
            <NuxtLink to="/#practice-example" class="btn btn-white" data-sample-entry>{{ t("official.v1.experience.start.sample") }}</NuxtLink>
          </div>
          <button class="v1-start-switch" type="button" @click="openDeviceOptions">{{ t("official.v1.experience.start.devices") }}</button>
          <p class="v1-start-login">{{ t("official.v1.experience.start.haveAccount") }} <NuxtLink :to="authLink()" external>{{ t("official.v1.experience.start.login") }}</NuxtLink></p>
        </div>
        <picture class="v1-start-journey-art" aria-hidden="true"><source media="(max-width: 768px)" srcset="/figma-v1/assets/start-mobile-168-1872/imgV11.svg" /><img src="/figma-v1/assets/start-desktop-168-1723/imgV11.svg" alt="" /></picture>
      </section>
      <p class="v1-start-boundary" role="status">{{ t("official.v1.experience.start.adultBoundary") }} <NuxtLink to="/announcements">{{ t("official.v1.experience.start.notices") }}</NuxtLink></p>

      <section class="v1-start-cards" :aria-label="t('official.v1.experience.start.exampleTitle')">
        <article v-for="card in cards" :key="card.key" class="v1-start-card" :class="`v1-start-card--${card.key}`">
          <div class="v1-start-card-heading"><h2>{{ t(`official.v1.experience.start.${card.key}Title`) }}</h2><span aria-hidden="true"><img src="/figma-v1/assets/start-desktop-168-1723/imgFrame1.svg" alt="" /></span></div>
          <p>{{ t(`official.v1.experience.start.${card.key}Description`) }}</p>
          <NuxtLink :to="card.href">{{ t("official.v1.experience.start.learnMore") }}<span aria-hidden="true">→</span></NuxtLink>
        </article>
      </section>

      <section class="v1-start-example" aria-labelledby="start-example-title">
        <p class="v1-start-eyebrow">{{ t("official.v1.experience.start.exampleLabel") }}</p>
        <h2 id="start-example-title">{{ t("official.v1.experience.start.exampleTitle") }}</h2>
        <p>{{ t("official.v1.experience.start.exampleDescription") }}</p>
        <div class="v1-start-example-grid">
          <div class="v1-start-duration">
            <h3>{{ t("official.v1.experience.start.durationQuestion") }}</h3>
            <div class="v1-start-duration-options" role="group" :aria-label="t('official.v1.experience.start.durationQuestion')">
              <button v-for="duration in durations" :key="duration" type="button" :aria-pressed="selectedDuration === duration" @click="selectedDuration = duration">{{ t(`official.v1.experience.start.duration${duration}`) }}</button>
            </div>
            <p>{{ t("official.v1.experience.start.demoNote") }}</p>
          </div>
          <div class="v1-start-steps">
            <h3>{{ t("official.v1.experience.start.stepsTitle") }}</h3>
            <ol>
              <li v-for="step in [1, 2, 3]" :key="step"><span>{{ String(step).padStart(2, "0") }}</span><div><strong>{{ t(`official.v1.experience.start.step${step}`) }}</strong><p>{{ t(`official.v1.experience.start.step${step}Description`) }}</p></div></li>
            </ol>
          </div>
        </div>
      </section>
    </div>
    <SiteModal :open="deviceDialogOpen" :title="t('official.v1.experience.start.deviceDialogTitle')" @close="closeDeviceOptions">
      <p>{{ t("official.v1.experience.start.deviceDialogDescription") }}</p>
      <input class="copy-field v1-start-copy-field" :value="siteAddress" :aria-label="t('official.v1.experience.start.addressLabel')" readonly @focus="selectAddress" />
      <button class="btn btn-primary btn-wide" type="button" @click="copy">{{ t("official.v1.experience.start.copy") }}<SiteIcon name="copy" /></button>
      <p role="status" aria-live="polite">{{ copyState }}</p>
      <p v-if="siteAddress.includes('127.0.0.1') || siteAddress.includes('localhost')" class="dialog-note">{{ t("official.v1.experience.start.localAddressNote") }}</p>
    </SiteModal>
  </div>
</template>

<style scoped>
.v1-start { color: var(--v1-text); background: var(--v1-surface); }
.v1-start-heading { padding: 0; overflow: hidden; background: linear-gradient(110deg, var(--v1-hero-from, var(--v1-brand-soft)), var(--v1-hero-to, var(--v1-bg))); }
.v1-start-heading :deep(.container), .v1-start-content { max-width: 1192px; }
.v1-start-heading :deep(.v1-page-heading__body) { min-height: 338px; position: relative; align-items: flex-start; }
.v1-start-heading :deep(.v1-page-heading__copy) { max-width: 700px; padding-top: 32px; }
.v1-start-heading :deep(.v1-page-heading__copy .eyebrow) { margin: 0; }
.v1-start-heading :deep(.v1-page-heading__copy h1) { font-size: 48px; font-weight: 900; letter-spacing: normal; line-height: 1.33; margin: 39px 0 30px; }
.v1-start-heading :deep(.v1-page-heading__copy > p) { font-size: 17px; }
.v1-start-heading :deep(.v1-page-heading__artwork) { position: static; flex: 0 0 368px; align-self: center; }
.v1-start-heading-card { position: relative; overflow: hidden; width: 368px; height: 220px; padding: 0; border: 18px solid var(--v1-surface); border-radius: 24px; transform: translate(-8px, 8px); background: var(--v1-brand-soft); display: block; }
.v1-start-heading-icon { display: block; position: absolute; left: 21px; top: 20px; margin: 0; }
.v1-start-card-ellipse { position: absolute; left: 188px; top: -38px; }
.v1-start-heading-ambient { position: absolute; inset: 0; pointer-events: none; }
.v1-start-heading-ambient img { position: absolute; }
.v1-start-orbit { right: -113px; top: -66px; }
.v1-start-orb { right: 45px; top: 156px; }
.v1-start-glimmer { right: 226px; top: 28px; }
.v1-start-mobile-art { display: none; }
.v1-start-heading-card span,.v1-start-heading-card small,.v1-start-eyebrow { color: var(--v1-brand); font: 600 13px var(--v1-font-display); }
.v1-start-heading-card > span { position: absolute; left: 21px; top: 70px; }
.v1-start-heading-card strong { position: absolute; left: 21px; top: 97px; font-size: 23px; }
.v1-start-heading-card small { position: absolute; left: 165px; top: 143px; max-width: 158px; margin: 0; }
.v1-start-progress { position: absolute; left: 21px; top: 140px; width: 124px; height: 6px; border-radius: 4px; background: var(--v1-surface); margin: 0; }
.v1-start-progress i { display: block; width: 68%; height: 100%; border-radius: inherit; background: var(--v1-brand); }
.v1-start-heading-word { position: absolute; right: 11px; top: 261px; width: 338px; opacity: .23; font: 600 31px var(--v1-font-display); color: var(--v1-start-hero-accent, var(--v1-brand)); }
.v1-start-heading-spark { position: absolute; right: -82px; top: 183px; color: var(--v1-start-hero-accent, var(--v1-brand)); opacity: .32; font-size: 39px; }
.v1-start-heading-bar { position: absolute; left: 0; top: 300px; width: 184px; height: 3px; border-radius: 2px; background: var(--v1-start-hero-accent, var(--v1-brand)); opacity: .25; }
.v1-start-content { padding-top: 52px; padding-bottom: 40px; }
.v1-start-journey { position: relative; min-height: 435px; padding: 33px 24px 26px; border-radius: 23px; background: var(--v1-brand-soft); overflow: hidden; }
.v1-start-journey-copy { position: relative; z-index: 1; max-width: 560px; }
.v1-start-journey h2 { margin: 34px 0 28px; font-size: 37px; line-height: 1.35; }
.v1-start-journey-copy > p:not(.v1-start-eyebrow) { font-size: 14px; color: var(--v1-muted); }
.v1-start-actions { display: grid; gap: 22px; width: min(248px, 100%); margin-top: 43px; }
.v1-start-actions .btn { min-height: 52px; justify-content: center; }
.v1-start-switch { border: 0; padding: 10px 0; margin-top: 8px; color: var(--v1-brand); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.v1-start-login { margin-top: 3px; }
.v1-start-login a,.v1-start-boundary a { color: var(--v1-brand); text-decoration: underline; text-underline-offset: 3px; }
.v1-start-journey-art { position: absolute; top: 67px; right: 5.5%; width: 431px; height: 277px; }
.v1-start-boundary { margin: 12px 0 20px; color: var(--v1-muted); font-size: 13px; line-height: 1.6; }
.v1-start-cards { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; }
.v1-start-card { position: relative; overflow: hidden; min-width: 0; min-height: 181px; padding: 18px; border: 1px solid var(--v1-border); border-radius: 20px; background: var(--v1-card-lilac, var(--v1-brand-soft)); }
.v1-start-card::before { content: ""; position: absolute; left: 0; top: 18px; width: 3px; height: 22px; border-radius: 2px; background: var(--v1-card-lilac-accent, var(--v1-brand)); }
.v1-start-card--record { background: var(--v1-card-mint, var(--v1-bg)); }.v1-start-card--record::before { background: var(--v1-card-mint-accent, var(--v1-brand)); }
.v1-start-card--review { background: var(--v1-card-sand, var(--v1-bg)); }.v1-start-card--review::before { background: var(--v1-card-sand-accent, var(--v1-brand)); }
.v1-start-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.v1-start-card h2 { font-size: 21px; margin: 0; }
.v1-start-card-heading span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px; background: var(--v1-surface); color: var(--v1-brand); }
.v1-start-card-heading img { display: block; }
.v1-start-card p { min-height: 38px; margin: 4px 0 12px; color: var(--v1-muted); font-size: 14px; }
.v1-start-card > a { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 7px 16px; border-top: 1px solid var(--v1-border); border-radius: 12px; color: var(--v1-brand); background: var(--v1-surface); font-size: 13px; }
.v1-start-example { margin-top: 50px; padding: 24px 22px 26px; border-radius: 25px; background: color-mix(in srgb,var(--v1-brand-soft) 23%,var(--v1-surface)); }
.v1-start-example > h2 { margin: 16px 6px 8px; font-size: 29px; }
.v1-start-example > p:not(.v1-start-eyebrow) { margin: 0 6px; color: var(--v1-muted); font-size: 13px; }
.v1-start-example-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 25px; }
.v1-start-duration,.v1-start-steps { min-height: 243px; padding: 17px; border-radius: 18px; background: var(--v1-surface); }
.v1-start-example-grid h3 { margin: 0; font-size: 16px; }
.v1-start-duration { display: flex; flex-direction: column; }
.v1-start-duration-options { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; margin-top: 23px; }
.v1-start-duration-options button { min-width: 0; min-height: 44px; border: 0; border-radius: 12px; color: var(--v1-brand); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.v1-start-duration-options button[aria-pressed="true"] { background: var(--v1-brand-soft); }
.v1-start-duration > p { margin-top: auto; color: var(--v1-muted); font-size: 12px; }
.v1-start-steps ol { display: grid; gap: 12px; padding: 0; margin: 15px 0 0; list-style: none; }
.v1-start-steps li { display: flex; align-items: start; gap: 10px; font-size: 14px; }
.v1-start-steps li > span { display: grid; place-items: center; flex: 0 0 52px; height: 35px; border-radius: 12px; color: var(--v1-brand); background: var(--v1-brand-soft); }
.v1-start-steps li p { margin: 4px 0 0; color: var(--v1-muted); font-size: 12px; }
.v1-start-copy-field { display: block; width: 100%; margin: 16px 0; color: var(--v1-text); background: var(--v1-surface); }
.v1-start :is(button,a,input):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
@media (max-width: 768px) {
  .v1-start-heading :deep(.container), .v1-start-content { width: calc(100% - 48px); }
  .v1-start-heading :deep(.v1-page-heading__body) { min-height: 315px; align-items: start; gap: 0; }
  .v1-start-heading :deep(.v1-page-heading__copy) { max-width: 100%; padding-top: 31px; }
  .v1-start-heading :deep(.v1-page-heading__copy h1) { max-width: 100%; margin: 30px 0 62px; font-size: 31px; line-height: 1.45; }
  .v1-start-heading :deep(.v1-page-heading__copy > p) { max-width: 280px; font-size: 14px; line-height: 26px; }
  .v1-start-heading :deep(.v1-page-heading__artwork) { position: static; flex: 0 0 0; width: 0; min-width: 0; }
  .v1-start-heading-card { position: absolute; right: 0; top: 26px; z-index: 1; }
  .v1-start-heading-card { position: absolute; overflow: hidden; min-height: 54px; width: 54px; height: 54px; padding: 15px; transform: none; border: 0; border-radius: 17px; background: var(--v1-surface); }
  .v1-start-heading-icon { position: static; margin: 0; }
  .v1-start-card-ellipse,.v1-start-desktop-art { display: none; }
  .v1-start-mobile-art { display: block; }
  .v1-start-orbit-mobile { right: -28px; top: 154px; }
  .v1-start-orbit-mobile-inner { right: -15px; top: 174px; }
  .v1-start-light-mobile { right: -33px; top: 32px; }
  .v1-start-ellipse-mobile { right: -81px; top: 100px; }
  .v1-start-heading-card :is(span,strong,small,.v1-start-progress) { display: none; }
  .v1-start-heading-word { display: block; left: 1px; right: auto; top: 263px; width: auto; opacity: .41; font-size: 11px; }
  .v1-start-heading-spark { right: 12px; top: 59px; width: 48px; font-size: 27px; font-weight: 700; line-height: normal; opacity: .65; }
  .v1-start-heading-bar { top: 283px; width: 74px; opacity: .33; }
  .v1-start-content { padding-top: 43px; }
  .v1-start-journey { min-height: 439px; padding: 33px 24px 24px; }
  .v1-start-journey h2 { margin: 34px 0 42px; font-size: 25px; }
  .v1-start-actions { width: 100%; margin-top: 49px; }
  .v1-start-journey-art { width: 72px; height: 47px; top: 12px; right: 23px; }
  .v1-start-cards { grid-template-columns: 1fr; gap: 12px; }
  .v1-start-card { min-height: 130px; border-radius: 16px; }
  .v1-start-card-heading span,.v1-start-card > a { display: none; }
  .v1-start-card p { margin-top: 14px; }
  .v1-start-example { margin-top: 50px; padding: 20px 15px 25px; }
  .v1-start-example > h2 { font-size: 23px; }
  .v1-start-example-grid { grid-template-columns: 1fr; gap: 16px; }
  .v1-start-duration { min-height: 147px; }
  .v1-start-steps { min-height: 197px; }
  .v1-start-steps li p { position: absolute; width: 1px; height: 1px; margin: 0; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .v1-start-duration-options { gap: 2px; margin-top: 15px; }
  .v1-start-duration > p { margin-top: 12px; }
}
@media (max-width: 360px) {
  .v1-start-heading :deep(.container), .v1-start-content { width: calc(100% - 32px); }
}
</style>
