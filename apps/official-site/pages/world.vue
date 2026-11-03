<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
import WorldScene from "~/components/v1/experience/WorldScene.vue";

const { t } = useSiteText();
const tab = ref<"room" | "game" | "wall">("room");
const morning = ref(false);
const message = ref("");
const selected = ref<number[]>([]);
const root = ref<HTMLElement>();
const panelId = useId();
const tabs = ["room", "game", "wall"] as const;
const words = ["wordEnglish", "wordI", "wordLearn"] as const;
const correct = computed(() => selected.value.length === 3 && selected.value.join(",") === "1,2,0");
const status = computed(() => correct.value ? "gameCorrect" : selected.value.length === 3 ? "gameIncorrect" : "gameEmpty");
const cards = ["room", "game", "wall"] as const;
async function selectTab(next: typeof tabs[number], moveFocus = false) {
  tab.value = next;
  message.value = "";
  if (moveFocus) { await nextTick(); root.value?.querySelector<HTMLElement>(`[data-world-tab="${next}"]`)?.focus(); }
}
function tabKeys(event: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(tab.value);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
  void selectTab(tabs[next]!, true);
}
async function addWord(index: number) {
  if (selected.value.includes(index)) return;
  selected.value.push(index);
  await nextTick();
  root.value?.querySelector<HTMLElement>(selected.value.length === words.length ? "[data-world-reset]" : "[data-world-word]:not(:disabled)")?.focus();
}
async function removeWord(index: number) {
  selected.value.splice(index, 1);
  await nextTick();
  root.value?.querySelector<HTMLElement>("[data-world-word]:not(:disabled)")?.focus();
}
function resetWords() { selected.value = []; void nextTick(() => root.value?.querySelector<HTMLElement>("[data-world-word]")?.focus()); }
useOfficialSeo({ title: t("official.v1.experience.world.seoTitle"), description: t("official.v1.experience.world.seoDescription"), path: "/world" });
</script>

<template>
  <div class="v1-world" ref="root">
    <PageHeading
      class="v1-world-heading"
      :title="t('official.v1.experience.world.title')"
      :lead="t('official.v1.experience.world.lead')"
      :label="t('official.v1.experience.world.label')"
      :show-breadcrumb="false"
    >
      <template #artwork>
        <div class="v1-world-heading-card" aria-hidden="true">
          <img class="v1-world-card-ellipse" src="/figma-v1/assets/world-desktop-168-1223/imgEllipse.svg" alt="" />
          <picture class="v1-world-heading-icon"><source media="(max-width: 768px)" srcset="/figma-v1/assets/world-mobile-168-1389/imgFrame.svg" /><img src="/figma-v1/assets/world-desktop-168-1223/imgFrame.svg" alt="" /></picture>
          <span>{{ t("official.v1.experience.world.heroEyebrow") }}</span>
          <strong>{{ t("official.v1.experience.world.heroTitle") }}</strong>
          <div class="v1-world-progress"><i /></div>
          <small>{{ t("official.v1.experience.world.heroDevice") }}</small>
        </div>
        <div class="v1-world-heading-ambient" aria-hidden="true">
          <img class="v1-world-orbit v1-world-desktop-art" src="/figma-v1/assets/world-desktop-168-1223/imgBrandOrbitMotionPath.svg" alt="" />
          <img class="v1-world-orb v1-world-desktop-art" src="/figma-v1/assets/world-desktop-168-1223/imgAmbientPastelOrb.svg" alt="" />
          <img class="v1-world-glimmer v1-world-desktop-art" src="/figma-v1/assets/world-desktop-168-1223/imgAmbientGlimmer.svg" alt="" />
          <img class="v1-world-orbit-mobile v1-world-mobile-art" src="/figma-v1/assets/world-mobile-168-1389/imgBrandOrbitMotionPath.svg" alt="" />
          <img class="v1-world-orbit-mobile-inner v1-world-mobile-art" src="/figma-v1/assets/world-mobile-168-1389/imgBrandOrbitMotionPath1.svg" alt="" />
          <img class="v1-world-light-mobile v1-world-mobile-art" src="/figma-v1/assets/world-mobile-168-1389/imgAmbientPastelLight.svg" alt="" />
          <img class="v1-world-ellipse-mobile v1-world-mobile-art" src="/figma-v1/assets/world-mobile-168-1389/imgEllipse.svg" alt="" />
        </div>
        <span class="v1-world-heading-word" aria-hidden="true">{{ t("official.v1.experience.world.heroWordmark") }}</span>
        <span class="v1-world-heading-spark" aria-hidden="true">{{ t("official.v1.experience.world.heroGlimmer") }}</span>
        <span class="v1-world-heading-bar" aria-hidden="true"></span>
      </template>
    </PageHeading>

    <div class="container v1-world-content">
      <div class="v1-world-toolbar">
        <div class="v1-world-tabs" role="tablist" :aria-label="t('official.v1.experience.world.tabList')" :aria-describedby="`${panelId}-boundary`" @keydown="tabKeys">
          <button v-for="item in tabs" :id="`${panelId}-${item}`" :key="item" :data-world-tab="item" role="tab" :aria-controls="panelId" :aria-selected="tab === item" :tabindex="tab === item ? 0 : -1" @click="selectTab(item)">{{ t(`official.v1.experience.world.${item}Tab`) }}</button>
        </div>
        <p class="v1-world-preview">{{ t("official.v1.experience.world.previewBadge") }}</p>
      </div>
      <section :id="panelId" class="v1-world-panel" role="tabpanel" :aria-labelledby="`${panelId}-${tab}`" :aria-describedby="`${panelId}-boundary`" tabindex="0">
        <template v-if="tab === 'room'">
          <div class="v1-world-views" role="group" :aria-label="t('official.v1.experience.world.viewLabel')"><button type="button" aria-pressed="true">{{ t("official.v1.experience.world.flatView") }}</button><button type="button" disabled>{{ t("official.v1.experience.world.depthLater") }}</button></div>
          <h2>{{ t("official.v1.experience.world.spaceTitle") }}</h2>
          <WorldScene :morning="morning" />
          <div class="v1-world-scene-options" role="group" :aria-label="t('official.v1.experience.world.roomTab')"><button type="button" :aria-pressed="!morning" @click="morning = false">{{ t("official.v1.experience.world.night") }}</button><button type="button" :aria-pressed="morning" @click="morning = true">{{ t("official.v1.experience.world.morning") }}</button><button type="button" @click="message = t('official.v1.experience.world.appearanceLater')">{{ t("official.v1.experience.world.appearance") }}</button></div>
          <p class="v1-world-live" role="status">{{ message }}</p>
        </template>
        <div v-else-if="tab === 'game'" class="v1-world-game">
          <h2>{{ t("official.v1.experience.world.gamePrompt") }}</h2>
          <div class="v1-world-selected" role="group" :aria-label="t('official.v1.experience.world.selectedLabel')"><button v-for="(word, index) in selected" :key="word" type="button" :aria-label="`${t('official.v1.experience.world.wordRemove')} ${t(`official.v1.experience.world.${words[word]}`)}`" @click="removeWord(index)">{{ t(`official.v1.experience.world.${words[word]}`) }}</button></div>
          <div class="v1-world-words" role="group" :aria-label="t('official.v1.experience.world.wordsLabel')"><button v-for="(word, index) in words" :key="word" data-world-word type="button" :disabled="selected.includes(index)" @click="addWord(index)">{{ t(`official.v1.experience.world.${word}`) }}</button></div>
          <p role="status" aria-live="polite">{{ t(`official.v1.experience.world.${status}`) }}</p>
          <button type="button" data-world-reset @click="resetWords">{{ t("official.v1.experience.world.gameReset") }}</button>
        </div>
        <div v-else class="v1-world-wall"><h2>{{ t("official.v1.experience.world.wallNoticeTitle") }}</h2><p>{{ t("official.v1.experience.world.wallNotice") }}</p></div>
      </section>
      <section class="v1-world-cards" :aria-label="t('official.v1.experience.world.tabList')">
        <article v-for="card in cards" :key="card" class="v1-world-card" :class="`v1-world-card--${card}`"><div><h2>{{ t(`official.v1.experience.world.${card}Title`) }}</h2><span aria-hidden="true"><img src="/figma-v1/assets/world-desktop-168-1223/imgFrame.svg" alt="" /></span></div><p>{{ t(`official.v1.experience.world.${card}Description`) }}</p><button type="button" @click="selectTab(card, true)">{{ t("official.v1.experience.world.tryContent") }}<span aria-hidden="true">→</span></button></article>
      </section>
      <p :id="`${panelId}-boundary`" class="v1-world-note">{{ t("official.v1.experience.world.note") }}</p>
      <section class="v1-world-example" aria-labelledby="world-example-title"><p class="v1-world-eyebrow">{{ t("official.v1.experience.world.trainLabel") }}</p><h2 id="world-example-title">{{ t("official.v1.experience.world.trainTitle") }}</h2><p>{{ t("official.v1.experience.world.trainDescription") }}</p>
        <div class="v1-world-example-grid"><div class="v1-world-train"><h3>{{ t("official.v1.experience.world.trainPreview") }}</h3><div class="v1-world-wagons"><span v-for="word in ['wordI', 'wordLearn', 'wordEnglish']" :key="word"><strong>{{ t(`official.v1.experience.world.${word}`) }}</strong><i aria-hidden="true">◉</i></span></div><p>{{ t("official.v1.experience.world.trainNote") }}</p></div><div class="v1-world-maturity"><h3>{{ t("official.v1.experience.world.maturityTitle") }}</h3><ol><li v-for="(name, index) in ['Train', 'Space', 'Study']" :key="name"><span>{{ t(index === 0 ? "official.v1.experience.world.phase0" : "official.v1.experience.world.phase1") }}</span><div><strong>{{ t(`official.v1.experience.world.maturity${name}`) }}</strong><p>{{ t(`official.v1.experience.world.maturity${name}Note`) }}</p></div></li></ol></div></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.v1-world { color: var(--v1-text); background: var(--v1-surface); }
.v1-world-heading { padding: 0; overflow: hidden; background: linear-gradient(110deg, var(--v1-world-hero-from, var(--v1-brand-soft)), var(--v1-world-hero-to, var(--v1-bg))); }
.v1-world-heading :deep(.container), .v1-world-content { max-width: 1192px; }
.v1-world-heading :deep(.v1-page-heading__body) { min-height: 338px; position: relative; align-items: flex-start; }
.v1-world-heading :deep(.v1-page-heading__copy) { max-width: 700px; padding-top: 32px; }
.v1-world-heading :deep(.v1-page-heading__copy .eyebrow) { margin: 0; }
.v1-world-heading :deep(.v1-page-heading__copy h1) { font-size: 48px; line-height: 1.33; margin: 39px 0 30px; }
.v1-world-heading :deep(.v1-page-heading__copy > p) { font-size: 17px; }
.v1-world-heading :deep(.v1-page-heading__artwork) { position: static; flex: 0 0 368px; align-self: center; }
.v1-world-heading-card { position: relative; overflow: hidden; width: 368px; height: 220px; padding: 0; border: 18px solid var(--v1-surface); border-radius: 24px; transform: translate(-8px, 8px); background: var(--v1-world-hero-to, var(--v1-brand-soft)); display: block; }
.v1-world-heading-icon { display: block; position: absolute; left: 21px; top: 20px; margin: 0; }
.v1-world-card-ellipse { position: absolute; left: 188px; top: -38px; }
.v1-world-heading-ambient { position: absolute; inset: 0; pointer-events: none; }
.v1-world-heading-ambient img { position: absolute; }
.v1-world-orbit { right: -113px; top: -66px; }
.v1-world-orb { right: 45px; top: 156px; }
.v1-world-glimmer { right: 226px; top: 28px; }
.v1-world-mobile-art { display: none; }
.v1-world-heading-card span,.v1-world-heading-card small,.v1-world-eyebrow { color: var(--v1-brand); font: 600 13px var(--v1-font-display); }
.v1-world-heading-card > span { position: absolute; left: 21px; top: 70px; }
.v1-world-heading-card strong { position: absolute; left: 21px; top: 97px; font-size: 23px; }
.v1-world-heading-card small { position: absolute; left: 165px; top: 143px; max-width: 158px; margin: 0; }
.v1-world-progress { position: absolute; left: 21px; top: 140px; width: 124px; height: 6px; border-radius: 4px; background: var(--v1-surface); margin: 0; }
.v1-world-progress i { display: block; width: 68%; height: 100%; border-radius: inherit; background: var(--v1-brand); }
.v1-world-heading-word { position: absolute; right: 11px; top: 261px; width: 338px; opacity: .3; font: 600 31px var(--v1-font-display); color: var(--v1-brand); }
.v1-world-heading-spark { position: absolute; right: -82px; top: 183px; color: var(--v1-brand); opacity: .32; font-size: 39px; }
.v1-world-heading-bar { position: absolute; left: 0; top: 300px; width: 184px; height: 3px; border-radius: 2px; background: var(--v1-brand); opacity: .25; }

.v1-world-content { padding-top: 52px; padding-bottom: 40px; }
.v1-world-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 21px; }
.v1-world-tabs { display: flex; flex-wrap: wrap; gap: 12px; }
.v1-world-tabs button { min-width: 118px; min-height: 44px; padding: 8px 18px; border: 0; border-radius: 22px; background: var(--v1-brand-soft); color: var(--v1-brand); font: inherit; font-size: 14px; cursor: pointer; }
.v1-world-tabs button[aria-selected="true"] { background: var(--v1-brand); color: var(--v1-on-brand); }
.v1-world-preview { margin: 0 0 0 8px; color: var(--v1-muted); font-size: 13px; line-height: 1.5; }
.v1-world-panel { min-height: 548px; padding: 20px 5.45% 22px; border-radius: 26px; background: var(--v1-scene-bg, var(--v1-text)); color: var(--v1-scene-text, var(--v1-on-brand)); }
.v1-world-views { display: flex; gap: 12px; margin-left: -4.3%; }
.v1-world-views button,.v1-world-scene-options button { min-height: 44px; padding: 0 8px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 14px; cursor: pointer; }
.v1-world-views button:disabled { opacity: .7; cursor: default; }
.v1-world-panel > h2 { margin: 13px 0 54px; text-align: center; font: 600 24px var(--v1-font-display); }
.v1-world-scene-options { display: flex; justify-content: center; gap: 14px; margin-top: 30px; }
.v1-world-scene-options button[aria-pressed="true"] { text-decoration: underline; text-underline-offset: 5px; }
.v1-world-live { min-height: 1em; text-align: center; font-size: 12px; }
.v1-world-game,.v1-world-wall { max-width: 720px; margin: 45px auto; }
.v1-world-game h2,.v1-world-wall h2 { font-size: 24px; }
.v1-world-selected,.v1-world-words { display: flex; flex-wrap: wrap; gap: 10px; min-height: 70px; margin: 24px 0; padding: 12px; border: 1px solid var(--v1-scene-detail, var(--v1-brand-soft)); border-radius: 14px; }
.v1-world-game button { min-height: 44px; padding: 8px 16px; border: 1px solid var(--v1-scene-detail, var(--v1-brand-soft)); border-radius: 12px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.v1-world-game button:disabled { opacity: .45; cursor: default; }
.v1-world-cards { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; margin-top: 28px; }
.v1-world-card { position: relative; overflow: hidden; min-height: 181px; padding: 18px; border: 1px solid var(--v1-border); border-radius: 20px; background: var(--v1-card-lilac, var(--v1-brand-soft)); }
.v1-world-card::before { content: ""; position: absolute; left: 0; top: 18px; width: 3px; height: 22px; border-radius: 2px; background: var(--v1-card-lilac-accent, var(--v1-brand)); }
.v1-world-card--game { background: var(--v1-card-mint, var(--v1-bg)); }.v1-world-card--game::before { background: var(--v1-card-mint-accent, var(--v1-brand)); }.v1-world-card--wall { background: var(--v1-card-sand, var(--v1-bg)); }.v1-world-card--wall::before { background: var(--v1-card-sand-accent, var(--v1-brand)); }
.v1-world-card > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.v1-world-card h2 { margin: 0; font-size: 21px; }.v1-world-card > div > span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px; background: var(--v1-surface); }
.v1-world-card p { min-height: 38px; margin: 4px 0 12px; color: var(--v1-muted); font-size: 14px; }
.v1-world-card > button { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 44px; padding: 7px 16px; border: 0; border-top: 1px solid var(--v1-border); border-radius: 12px; color: var(--v1-brand); background: var(--v1-surface); font: inherit; font-size: 13px; cursor: pointer; }
.v1-world-note { margin: 22px 0 0; padding: 17px 18px; border-radius: 17px; background: var(--v1-brand-soft); color: var(--v1-muted); font-size: 14px; }
.v1-world-example { margin-top: 28px; padding: 24px 22px 26px; border-radius: 25px; background: color-mix(in srgb,var(--v1-brand-soft) 23%,var(--v1-surface)); }
.v1-world-example > h2 { margin: 16px 6px 8px; font-size: 29px; }.v1-world-example > p:not(.v1-world-eyebrow) { margin: 0 6px; color: var(--v1-muted); font-size: 13px; }
.v1-world-example-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 25px; }.v1-world-train,.v1-world-maturity { min-height: 243px; padding: 17px; border-radius: 18px; background: var(--v1-surface); }.v1-world-example-grid h3 { margin: 0; font-size: 17px; }
.v1-world-train { display: flex; flex-direction: column; }.v1-world-wagons { display: flex; gap: 14px; margin-top: 18px; }.v1-world-wagons > span { display: flex; flex-direction: column; justify-content: center; gap: 2px; width: 147px; height: 61px; padding: 8px 11px; border-radius: 13px; background: var(--v1-brand-soft); font-size: 15px; }.v1-world-wagons > span:nth-child(2) { background: var(--v1-download-hero-from, var(--v1-brand-soft)); }.v1-world-wagons i { color: var(--v1-brand); font-style: normal; }.v1-world-train > p { margin-top: auto; color: var(--v1-muted); font-size: 12px; }
.v1-world-maturity ol { display: grid; gap: 14px; padding: 0; margin: 15px 0 0; list-style: none; }.v1-world-maturity li { display: flex; gap: 12px; align-items: start; font-size: 14px; }.v1-world-maturity li > span { display: grid; place-items: center; flex: 0 0 53px; height: 35px; border-radius: 12px; color: var(--v1-brand); background: var(--v1-brand-soft); }.v1-world-maturity li:first-child > span { background: var(--v1-card-mint, var(--v1-brand-soft)); }.v1-world-maturity li p { margin: 4px 0 0; color: var(--v1-muted); font-size: 12px; }
.v1-world :is(button,a):focus-visible,.v1-world-panel:focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
@media (max-width: 768px) {
  .v1-world-heading :deep(.container), .v1-world-content { width: calc(100% - 48px); }
  .v1-world-heading :deep(.v1-page-heading__body) { min-height: 315px; align-items: start; }
  .v1-world-heading :deep(.v1-page-heading__copy) { max-width: 100%; padding-top: 31px; }
  .v1-world-heading :deep(.v1-page-heading__copy h1) { max-width: 310px; margin: 30px 0 62px; font-size: 31px; line-height: 1.45; }
  .v1-world-heading :deep(.v1-page-heading__copy > p) { max-width: 280px; font-size: 14px; line-height: 26px; }
  .v1-world-heading :deep(.v1-page-heading__artwork) { position: static; flex: 0 0 0; width: 0; min-width: 0; }
  .v1-world-heading-card { position: absolute; right: 0; top: 26px; z-index: 1; }
  .v1-world-heading-card { position: absolute; overflow: hidden; min-height: 54px; width: 54px; height: 54px; padding: 15px; transform: none; border: 0; border-radius: 17px; background: var(--v1-surface); }
  .v1-world-heading-icon { position: static; margin: 0; }
  .v1-world-card-ellipse,.v1-world-desktop-art { display: none; }
  .v1-world-mobile-art { display: block; }
  .v1-world-orbit-mobile { right: -28px; top: 154px; }
  .v1-world-orbit-mobile-inner { right: -15px; top: 174px; }
  .v1-world-light-mobile { right: -33px; top: 32px; }
  .v1-world-ellipse-mobile { right: -81px; top: 100px; }
  .v1-world-heading-card :is(span,strong,small,.v1-world-progress) { display: none; }
  .v1-world-heading-word { display: block; left: 1px; right: auto; top: 263px; width: auto; font-size: 11px; }
  .v1-world-heading-spark { right: 12px; top: 59px; font-size: 27px; opacity: .65; }
  .v1-world-heading-bar { top: 283px; width: 74px; }

  .v1-world-content { padding-top: 43px; }.v1-world-tabs { gap: 8px; }.v1-world-preview { margin-left: 0; }.v1-world-tabs button { flex: 0 0 79px; min-width: 79px; padding: 8px; font-size: 14px; }
  .v1-world-panel { min-height: 440px; padding: 20px; }.v1-world-views { margin: 0; }.v1-world-views button { padding-left: 0; font-size: 12px; }.v1-world-panel > h2 { margin: 22px 0 38px; font-size: 16px; }.v1-world-scene-options { gap: 5px; margin-top: 25px; }.v1-world-scene-options button { font-size: 12px; }
  .v1-world-cards { grid-template-columns: 1fr; gap: 12px; margin-top: 23px; }.v1-world-card { min-height: 130px; border-radius: 16px; }.v1-world-card > div > span,.v1-world-card > button { display: none; }.v1-world-card p { margin-top: 14px; }
  .v1-world-example { padding: 20px 15px 25px; }.v1-world-example > h2 { font-size: 23px; }.v1-world-example-grid { grid-template-columns: 1fr; gap: 16px; }.v1-world-train { min-height: 147px; }.v1-world-maturity { min-height: 197px; }.v1-world-wagons { gap: 7px; }.v1-world-wagons > span { width: 0; flex: 1; }.v1-world-train > p { margin-top: 12px; }
}
@media (max-width: 360px) { .v1-world-heading :deep(.container), .v1-world-content { width: calc(100% - 32px); } }
</style>
