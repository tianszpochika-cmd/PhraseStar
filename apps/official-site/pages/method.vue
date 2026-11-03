<script setup lang="ts">
import CoreHero from "~/components/v1/core/Hero.vue";
import CoreFeatureCards from "~/components/v1/core/FeatureCards.vue";
import { useOfficialSeo } from "~/utils/seo";

const { t } = useSiteText();
const sample = ref<HTMLElement | null>(null);
const selected = ref<number[]>([]);
const feedback = ref<"" | "incomplete" | "correct" | "incorrect">("");
const words = computed(() => [1, 2, 3, 4, 5].map((number) => t(`official.v1.core.method.token${number}`)));
const chosenSentence = computed(() => selected.value.map((index) => words.value[index]).join(" "));
const features = computed(() => [
  { title: t("official.v1.core.method.recognize"), description: t("official.v1.core.method.recognizeNote") },
  { title: t("official.v1.core.method.practice"), description: t("official.v1.core.method.practiceNote") },
  { title: t("official.v1.core.method.review"), description: t("official.v1.core.method.reviewNote") },
]);
function toggleWord(index: number) {
  const position = selected.value.indexOf(index);
  if (position === -1) selected.value = [...selected.value, index];
  else selected.value = selected.value.filter((item) => item !== index);
  feedback.value = "";
}
function checkAnswer() {
  feedback.value = selected.value.length !== words.value.length
    ? "incomplete"
    : selected.value.every((value, index) => value === index) ? "correct" : "incorrect";
}
function reset() {
  selected.value = [];
  feedback.value = "";
  void nextTick(() => sample.value?.querySelector<HTMLButtonElement>("[data-word]")?.focus());
}
useOfficialSeo({ title: t("official.v1.core.method.seoTitle"), description: t("official.v1.core.method.seoDescription"), path: "/method" });
</script>
<template>
  <div class="v1-core-method">
    <CoreHero variant="method" :eyebrow="t('official.v1.core.method.eyebrow')" :title="t('official.v1.core.method.title')" :lead="t('official.v1.core.method.lead')" :art-eyebrow="t('official.v1.core.method.artEyebrow')" :art-title="t('official.v1.core.method.artTitle')" :art-count="t('official.v1.core.method.artCount')" :caption="t('official.v1.core.method.artCaption')" />
    <div class="v1-core-method__container">
      <section ref="sample" class="v1-core-method__sample" aria-labelledby="method-sample-title">
        <div class="v1-core-method__practice">
          <p class="v1-core-method__eyebrow">{{ t("official.v1.core.method.tryEyebrow") }}</p>
          <h2 id="method-sample-title">{{ t("official.v1.core.method.tryTitle") }}</h2>
          <p class="v1-core-method__prompt">{{ t("official.v1.core.method.prompt") }}</p>
          <div class="v1-core-method__words" role="group" :aria-label="t('official.v1.core.method.tokensLabel')">
            <button v-for="(word, index) in words" :key="index" type="button" data-word :aria-pressed="selected.includes(index)" @click="toggleWord(index)">
              <span>{{ word }}</span><sup v-if="selected.includes(index)">{{ selected.indexOf(index) + 1 }}</sup>
            </button>
          </div>
          <p v-if="selected.length" class="v1-core-method__selected" aria-live="polite">{{ t("official.v1.core.method.selected", { sentence: chosenSentence }) }}</p>
          <p v-if="feedback" class="v1-core-method__feedback" role="status">{{ t(`official.v1.core.method.${feedback}`) }}</p>
          <div class="v1-core-method__actions"><button class="v1-core-method__check" type="button" @click="checkAnswer">{{ t("official.v1.core.method.check") }}</button><button v-if="selected.length || feedback" class="v1-core-method__reset" type="button" @click="reset">{{ t("official.v1.core.method.reset") }}</button></div>
          <p class="v1-core-method__notice">{{ t("official.v1.core.method.sampleNotice") }}</p>
        </div>
        <aside class="v1-core-method__answer" :aria-label="t('official.v1.core.method.answerTitle')">
          <p class="v1-core-method__eyebrow">{{ t("official.v1.core.method.answerEyebrow") }}</p>
          <span class="v1-core-method__tick" aria-hidden="true">✓</span>
          <h3>{{ t("official.v1.core.method.answerTitle") }}</h3>
          <strong>{{ t("official.v1.core.method.answer") }}</strong>
          <p>{{ t("official.v1.core.method.answerNote") }}</p>
        </aside>
      </section>
      <CoreFeatureCards variant="method" :cards="features" icon="/figma-v1/assets/method-desktop-168-1502/imgFrame1.svg" :action="t('official.v1.core.method.viewSteps')" target="#recall-loop" />
      <section id="recall-loop" class="v1-core-method__loop" aria-labelledby="method-loop-title">
        <p class="v1-core-method__eyebrow">{{ t("official.v1.core.method.loopEyebrow") }}</p>
        <h2 id="method-loop-title">{{ t("official.v1.core.method.loopTitle") }}</h2>
        <p>{{ t("official.v1.core.method.loopLead") }}</p>
        <div class="v1-core-method__loop-columns">
          <div class="v1-core-method__stages">
            <h3>{{ t("official.v1.core.method.loopHeading") }}</h3>
            <ol><li v-for="step in 3" :key="step"><strong>{{ t(`official.v1.core.method.stage${step}`) }}</strong><small>{{ t(`official.v1.core.method.stage${step}Note`) }}</small></li></ol>
          </div>
          <div class="v1-core-method__repair">
            <h3>{{ t("official.v1.core.method.feedbackTitle") }}</h3>
            <div><strong>{{ t("official.v1.core.method.feedbackNext") }}</strong><p>{{ t("official.v1.core.method.feedbackPath") }}</p></div>
            <p>{{ t("official.v1.core.method.feedbackNote") }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.v1-core-method { background: var(--v1-surface); color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-core-method__container { width: min(1192px, calc(100% - 48px)); margin: auto; padding: 52px 0 40px; }
.v1-core-method__sample { display: grid; grid-template-columns: minmax(0, 1fr) 304px; gap: 36px; min-height: 335px; margin-bottom: 36px; padding: 23px 36px 24px 24px; border-radius: 24px; background: var(--v1-brand-soft); }
.v1-core-method__practice { min-width: 0; }
.v1-core-method__eyebrow { color: var(--v1-brand); font: 600 12px/1.3 var(--v1-font-display); }
.v1-core-method__sample h2 { margin-top: 18px; font-size: 29px; }
.v1-core-method__prompt { margin-top: 14px; color: var(--v1-copy-secondary); font-size: 15px; }
.v1-core-method__words { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 33px; }
.v1-core-method__words button { position: relative; min-width: 0; min-height: 48px; border: 2px solid transparent; border-radius: 12px; background: var(--v1-surface); color: var(--v1-brand); font: 600 16px var(--v1-font-display); }
.v1-core-method__words button[aria-pressed="true"] { border-color: var(--v1-brand); }
.v1-core-method__words sup { position: absolute; top: 3px; right: 7px; font-size: 10px; }
.v1-core-method__selected, .v1-core-method__feedback { margin-top: 12px; color: var(--v1-text); font-size: 13px; }
.v1-core-method__feedback { font-weight: 600; }
.v1-core-method__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 42px; }
.v1-core-method__check, .v1-core-method__reset { min-height: 52px; padding: 0 20px; border-radius: 14px; font-size: 15px; font-weight: 700; }
.v1-core-method__check { width: 226px; background: var(--v1-brand); color: var(--v1-on-brand); }
.v1-core-method__reset { border: 1px solid var(--v1-brand); background: var(--v1-surface); color: var(--v1-brand); }
.v1-core-method__notice { margin-top: 12px; color: var(--v1-muted); font-size: 12px; }
.v1-core-method__answer { min-width: 0; padding: 18px 20px; border-radius: 23px; background: var(--v1-surface); }
.v1-core-method__tick { display: grid; place-items: center; width: 49px; height: 49px; margin-top: 18px; border-radius: 15px; background: var(--v1-method-complete-bg); color: var(--v1-brand); font-size: 28px; }
.v1-core-method__answer h3 { margin-top: 12px; font-size: 20px; }
.v1-core-method__answer > strong { display: flex; align-items: center; min-height: 72px; margin-top: 12px; padding: 14px; border-radius: 13px; background: var(--v1-hero-art-surface); color: var(--v1-brand); font: 600 16px/1.4 var(--v1-font-display); }
.v1-core-method__answer > p:last-child { margin-top: 20px; color: var(--v1-muted); font-size: 13px; }
.v1-core-method__loop { margin-top: 46px; padding: 24px 22px 26px; border-radius: 25px; background: var(--v1-section-soft); }
.v1-core-method__loop > .v1-core-method__eyebrow, .v1-core-method__loop > h2, .v1-core-method__loop > p:not(.v1-core-method__eyebrow) { margin-left: 6px; }
.v1-core-method__loop > h2 { margin-top: 16px; font-size: 29px; }
.v1-core-method__loop > p:not(.v1-core-method__eyebrow) { margin-top: 10px; color: var(--v1-muted); font-size: 13px; }
.v1-core-method__loop-columns { display: grid; grid-template-columns: 1fr 1.03fr; gap: 18px; margin-top: 27px; }
.v1-core-method__stages, .v1-core-method__repair { min-width: 0; min-height: 243px; padding: 18px; border-radius: 18px; background: var(--v1-surface); }
.v1-core-method__stages h3 { font-size: 16px; }
.v1-core-method__stages ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 30px 0 0; padding: 0; list-style: none; }
.v1-core-method__stages li { min-width: 0; min-height: 70px; padding: 10px; border-radius: 13px; background: var(--v1-goal-lilac); }
.v1-core-method__stages li:nth-child(2) { background: var(--v1-goal-sky); }
.v1-core-method__stages li:nth-child(3) { background: var(--v1-goal-mint); }
.v1-core-method__stages strong, .v1-core-method__stages small { display: block; }
.v1-core-method__stages strong { color: var(--v1-brand); font-size: 15px; }
.v1-core-method__stages small { margin-top: 8px; color: var(--v1-muted); font-size: 11px; }
.v1-core-method__repair h3 { font-size: 19px; }
.v1-core-method__repair > div { min-height: 96px; margin-top: 18px; padding: 15px 17px; border-radius: 15px; background: var(--v1-goal-lilac); }
.v1-core-method__repair > div strong { font-size: 16px; }
.v1-core-method__repair > div p { margin-top: 8px; color: var(--v1-muted); font-size: 13px; }
.v1-core-method__repair > p { margin-top: 26px; color: var(--v1-muted); font-size: 13px; }
.v1-core-method :is(button, a):focus-visible { outline-color: var(--v1-focus); }
:root[data-theme="high-contrast"] .v1-core-method__words button, :root[data-theme="high-contrast"] .v1-core-method__stages li { border: 1px solid var(--v1-border); }
:root[data-theme="high-contrast"] .v1-core-method__words button[aria-pressed="true"] { border: 2px solid var(--v1-focus); }
@media (max-width: 850px) { .v1-core-method__sample { grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; } }
@media (max-width: 700px) {
  .v1-core-method__container { padding-top: 43px; }
  .v1-core-method__sample { display: block; min-height: 351px; margin-bottom: 24px; padding: 18px 24px 24px; }
  .v1-core-method__sample h2 { margin-top: 14px; font-size: 21px; }
  .v1-core-method__prompt { margin-top: 26px; }
  .v1-core-method__words { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px 10px; margin-top: 26px; }
  .v1-core-method__actions { margin-top: 12px; }
  .v1-core-method__check { width: min(266px, 100%); }
  .v1-core-method__answer { display: none; }
  .v1-core-method__loop { margin-top: 46px; padding: 20px 15px 32px; }
  .v1-core-method__loop > .v1-core-method__eyebrow, .v1-core-method__loop > h2, .v1-core-method__loop > p:not(.v1-core-method__eyebrow) { margin-left: 2px; }
  .v1-core-method__loop > h2 { font-size: 23px; }
  .v1-core-method__loop-columns { grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
  .v1-core-method__stages, .v1-core-method__repair { min-height: 0; padding: 16px; border-radius: 17px; }
  .v1-core-method__stages h3 { font-size: 13px; }
  .v1-core-method__stages ol { gap: 8px; margin-top: 22px; }
  .v1-core-method__stages li { padding: 10px 8px; }
  .v1-core-method__repair { min-height: 197px; }
  .v1-core-method__repair > p { margin-top: 15px; }
}
</style>
