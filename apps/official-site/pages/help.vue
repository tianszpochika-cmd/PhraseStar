<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";

type HelpGroup = "all" | "start" | "learning" | "devices";
const { t } = useSiteText();
const query = ref("");
const group = ref<HelpGroup>("all");
const openQuestion = ref<number | null>(null);
const searchInput = ref<HTMLInputElement>();
const faqHeading = ref<HTMLElement>();
const base = "/figma-v1/assets/help-desktop-180-84";
const mobileBase = "/figma-v1/assets/help-mobile-180-242";
const categories: { id: HelpGroup; label: string }[] = [
  { id: "all", label: "official.v1.info.help.all" },
  { id: "start", label: "official.v1.info.help.start" },
  { id: "learning", label: "official.v1.info.help.learning" },
  { id: "devices", label: "official.v1.info.help.devices" },
];
const questions: { id: number; group: HelpGroup }[] = [
  { id: 1, group: "start" }, { id: 2, group: "start" },
  { id: 3, group: "devices" }, { id: 4, group: "learning" },
  { id: 5, group: "learning" }, { id: 6, group: "devices" },
  { id: 7, group: "learning" }, { id: 8, group: "devices" },
];
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  return questions.filter(({ id, group: questionGroup }) =>
    (group.value === "all" || group.value === questionGroup) &&
    (!needle || `${t(`official.v1.info.help.question${id}`)} ${t(`official.v1.info.help.answer${id}`)}`.toLocaleLowerCase().includes(needle)),
  );
});
function selectGroup(next: HelpGroup) {
  group.value = next;
  openQuestion.value = null;
}
async function selectTopic(next: HelpGroup) {
  query.value = "";
  selectGroup(next);
  await nextTick();
  faqHeading.value?.focus();
}
async function resetSearch(resetGroup = false) {
  query.value = "";
  if (resetGroup) selectGroup("all");
  await nextTick();
  searchInput.value?.focus();
}
useOfficialSeo({
  title: t("official.v1.info.help.seoTitle"),
  description: t("official.v1.info.help.lead"),
  path: "/help",
});
</script>

<template>
  <div class="v1-info-help">
    <section class="v1-info-help__hero">
      <div class="v1-info-help__hero-inner">
        <div class="v1-info-help__hero-copy">
          <p class="v1-info-help__eyebrow">{{ t("official.v1.info.help.eyebrow") }}</p>
          <h1>{{ t("official.v1.info.help.title") }}</h1>
          <p class="v1-info-help__lead">{{ t("official.v1.info.help.lead") }}</p>
          <span class="v1-info-help__hero-line" aria-hidden="true"></span>
        </div>
        <div class="v1-info-help__hero-art" aria-hidden="true">
          <img class="v1-info-help__glow v1-info-help__desktop-art" :src="`${base}/imgAtmosphereGlow.svg`" alt="" />
          <img class="v1-info-help__orbit v1-info-help__desktop-art" :src="`${base}/imgMotionGentleOrbit.svg`" alt="" />
          <img class="v1-info-help__orbit-small v1-info-help__desktop-art" :src="`${base}/imgMotionGentleOrbit1.svg`" alt="" />
          <img class="v1-info-help__mobile-glow v1-info-help__mobile-art" :src="`${mobileBase}/imgAtmosphereGlow.svg`" alt="" />
          <img class="v1-info-help__mobile-orbit v1-info-help__mobile-art" :src="`${mobileBase}/imgMotionGentleOrbit.svg`" alt="" />
          <div class="v1-info-help__hero-card">
            <div class="v1-info-help__hero-card-content">
              <img class="v1-info-help__hero-ellipse" :src="`${base}/imgEllipse.svg`" alt="" />
              <img class="v1-info-help__hero-icon v1-info-help__desktop-art" :src="`${base}/imgFrame.svg`" alt="" />
              <img class="v1-info-help__hero-icon v1-info-help__mobile-art" :src="`${mobileBase}/imgFrame.svg`" alt="" />
              <p>{{ t("official.v1.info.help.heroLabel") }}</p>
              <strong>{{ t("official.v1.info.help.heroTitle") }}</strong>
              <span>{{ t("official.v1.info.help.heroNote") }}</span>
            </div>
          </div>
          <span class="v1-info-help__hero-caption">{{ t("official.v1.info.help.heroCaption") }}</span>
        </div>
        <span class="v1-info-help__mobile-caption" aria-hidden="true">{{ t("official.v1.info.help.heroCaption") }}</span>
      </div>
    </section>

    <section class="v1-info-help__body">
      <div class="v1-info-help__container">
        <div class="v1-info-help__search">
          <SiteIcon name="search" />
          <input ref="searchInput" v-model="query" type="search" :placeholder="t('official.v1.info.help.search')" :aria-label="t('official.v1.info.help.search')" />
          <button v-if="query" type="button" :aria-label="t('official.v1.info.help.clearSearch')" @click="resetSearch()"><SiteIcon name="close" /></button>
        </div>
        <nav class="v1-info-help__categories" :aria-label="t('official.v1.info.help.categories')">
          <button v-for="item in categories" :key="item.id" type="button" :aria-pressed="group === item.id" @click="selectGroup(item.id)">{{ t(item.label) }}</button>
        </nav>
        <h2 ref="faqHeading" class="v1-info-help__faq-title" tabindex="-1">{{ t("official.v1.info.help.faq") }}</h2>
        <div class="v1-info-help__faq-layout">
          <div>
            <div v-if="filtered.length" class="v1-info-help__faqs">
              <article v-for="item in filtered" :key="item.id" class="v1-info-help__faq" :class="{ 'is-open': openQuestion === item.id }">
                <h3>
                  <button type="button" :aria-expanded="openQuestion === item.id" :aria-controls="`help-answer-${item.id}`" @click="openQuestion = openQuestion === item.id ? null : item.id">
                    <span>{{ t(`official.v1.info.help.question${item.id}`) }}</span><span class="v1-info-help__chevron" aria-hidden="true">⌄</span>
                  </button>
                </h3>
                <div :id="`help-answer-${item.id}`" v-show="openQuestion === item.id" class="v1-info-help__answer">
                  <p v-for="(paragraph, index) in t(`official.v1.info.help.answer${item.id}`).split(/\n\s*\n/)" :key="index">{{ paragraph }}</p>
                </div>
              </article>
            </div>
            <div v-else class="v1-info-help__empty" role="status">
              <h3>{{ t("official.v1.info.help.noResults") }}</h3>
              <p>{{ t("official.v1.info.help.noResultsHelp") }}</p>
              <button type="button" @click="resetSearch(true)">{{ t("official.v1.info.help.reset") }} <span aria-hidden="true">→</span></button>
            </div>
          </div>
          <aside class="v1-info-help__topics" :aria-label="t('official.v1.info.help.topicsTitle')">
            <div class="v1-info-help__topics-title"><img :src="`${base}/imgFrame.svg`" alt="" /><h3>{{ t("official.v1.info.help.topicsTitle") }}</h3></div>
            <p class="v1-info-help__topics-label">{{ t("official.v1.info.help.topicsLabel") }}</p>
            <div class="v1-info-help__topic-list">
              <button type="button" @click="selectTopic('start')"><img :src="`${base}/imgFrame1.svg`" alt="" /><span>{{ t("official.v1.info.help.account") }}</span><span aria-hidden="true">→</span></button>
              <button type="button" @click="selectTopic('learning')"><img :src="`${base}/imgFrame2.svg`" alt="" /><span>{{ t("official.v1.info.help.courses") }}</span><span aria-hidden="true">→</span></button>
              <button type="button" @click="selectTopic('devices')"><img :src="`${base}/imgFrame3.svg`" alt="" /><span>{{ t("official.v1.info.help.crossDevice") }}</span><span aria-hidden="true">→</span></button>
              <NuxtLink to="/terms"><img :src="`${base}/imgFrame4.svg`" alt="" /><span>{{ t("official.v1.info.help.productHelp") }}</span><span aria-hidden="true">→</span></NuxtLink>
            </div>
            <p class="v1-info-help__topics-hint">{{ t("official.v1.info.help.topicsHint") }}</p>
          </aside>
        </div>
        <section id="contact" class="v1-info-help__contact">
          <h2>{{ t("official.v1.info.help.contactTitle") }}</h2>
          <p>{{ t("official.v1.info.help.contactText") }}</p>
          <SiteStartButton :label="t('official.v1.info.help.startLearning')" :show-icon="false" />
        </section>
        <section class="v1-info-help__useful">
          <p class="v1-info-help__eyebrow">{{ t("official.v1.info.help.usefulEyebrow") }}</p>
          <h2>{{ t("official.v1.info.help.usefulTitle") }}</h2>
          <p class="v1-info-help__useful-intro">{{ t("official.v1.info.help.usefulIntro") }}</p>
          <div class="v1-info-help__useful-grid">
            <div class="v1-info-help__useful-card">
              <h3>{{ t("official.v1.info.help.entries") }}</h3>
              <div v-for="(item, index) in ['accountEntry', 'planEntry', 'reviewEntry']" :key="item" class="v1-info-help__useful-row"><span>0{{ index + 1 }}</span><p>{{ t(`official.v1.info.help.${item}`) }}</p></div>
            </div>
            <div class="v1-info-help__useful-card v1-info-help__steps">
              <h3>{{ t("official.v1.info.help.steps") }}</h3>
              <div v-for="(item, index) in ['stepSearch', 'stepFilter', 'stepAnswer']" :key="item" class="v1-info-help__useful-row"><span>0{{ index + 1 }}</span><p>{{ t(`official.v1.info.help.${item}`) }}</p></div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.v1-info-help { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-info-help p { color: inherit; }
.v1-info-help :is(button, a, input):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
.v1-info-help__hero { background: linear-gradient(100deg, color-mix(in srgb, var(--v1-brand-soft) 85%, var(--v1-surface)), color-mix(in srgb, var(--v1-brand-soft) 55%, var(--v1-surface))); overflow: hidden; }
.v1-info-help__hero-inner, .v1-info-help__container { width: min(1192px, calc(100% - 48px)); margin: 0 auto; }
.v1-info-help__hero-inner { height: 319px; position: relative; }
.v1-info-help__hero-copy { position: relative; z-index: 1; padding-top: 30px; }
.v1-info-help__eyebrow { color: var(--v1-brand) !important; font: 600 12px/1.3 var(--v1-font-display); }
.v1-info-help__hero h1 { font-size: 46px; line-height: 65px; font-weight: 900; margin-top: 45px; }
.v1-info-help__lead { color: var(--v1-muted) !important; font-size: 17px; line-height: 29px; margin-top: 32px; }
.v1-info-help__hero-line { display: block; width: 180px; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--v1-decor-lilac, var(--v1-brand)) 27%, transparent); margin-top: 77px; }
.v1-info-help__hero-art { position: absolute; inset: 0 0 0 auto; width: 420px; }
.v1-info-help__hero-art img { max-width: none; }
.v1-info-help__glow { position: absolute; width: 200px; height: 200px; right: 29px; top: 48px; }
.v1-info-help__orbit { position: absolute; width: 277px; height: 277px; right: -77px; top: 11px; }
.v1-info-help__orbit-small { position: absolute; width: 165px; height: 165px; right: -12px; top: 55px; }
.v1-info-help__hero-card { position: absolute; right: 9px; top: 70px; width: 371px; height: 204px; padding: 15px; border-radius: 23px; background: var(--v1-surface); }
.v1-info-help__hero-card-content { position: relative; height: 174px; overflow: hidden; border-radius: 18px; background: var(--v1-brand-soft); padding: 22px; }
.v1-info-help__hero-ellipse { position: absolute; right: -30px; top: -30px; width: 131px; height: 131px; }
.v1-info-help__hero-icon { position: relative; width: 24px; height: 24px; }
.v1-info-help__hero-card p { position: relative; margin-top: 23px; color: var(--v1-brand); font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-help__hero-card strong { position: relative; display: block; margin-top: 12px; font-size: 24px; line-height: 1.35; }
.v1-info-help__hero-card span { display: block; margin-top: 11px; color: var(--v1-muted); font: 600 11px/1.3 var(--v1-font-display); }
.v1-info-help__hero-caption { position: absolute; top: 269px; left: 94px; width: 401px; color: color-mix(in srgb, var(--v1-decor-lilac, var(--v1-brand)) 39%, transparent); font: 600 23px/1 var(--v1-font-display); }
.v1-info-help__mobile-art, .v1-info-help__mobile-caption { display: none; }
.v1-info-help__body { padding: 68px 0 38px; background: var(--v1-surface); }
.v1-info-help__search { height: 58px; display: flex; align-items: center; gap: 10px; padding: 0 18px; border-radius: 17px; background: color-mix(in srgb, var(--v1-bg) 75%, var(--v1-border)); color: var(--v1-muted); }
.v1-info-help__search :deep(.icon) { width: 16px; height: 16px; }
.v1-info-help__search input { width: 100%; min-width: 0; padding: 0; border: 0; outline-offset: 5px; background: transparent; font-size: 15px; }
.v1-info-help__search input::placeholder { color: var(--v1-muted); opacity: 1; }
.v1-info-help__search button { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 44px; }
.v1-info-help__categories { display: flex; gap: 16px; margin-top: 25px; }
.v1-info-help__categories button { width: 152px; min-height: 44px; border-radius: 16px; color: var(--v1-brand); background: var(--v1-brand-soft); font-size: 13px; font-weight: 500; }
.v1-info-help__categories button[aria-pressed="true"] { color: var(--v1-on-brand); background: var(--v1-brand); }
.v1-info-help__faq-title { margin: 39px 0 28px; font-size: 29px; line-height: 1.2; font-weight: 700; }
.v1-info-help__faq-layout { display: grid; grid-template-columns: minmax(0, 762fr) minmax(300px, 398fr); gap: 32px; align-items: start; }
.v1-info-help__faqs { display: grid; gap: 11px; }
.v1-info-help__faq { position: relative; overflow: hidden; border: 1px solid var(--v1-border); border-radius: 14px; background: color-mix(in srgb, var(--v1-brand-soft) 44%, var(--v1-bg)); }
.v1-info-help__faq:nth-child(even) { background: var(--v1-bg); }
.v1-info-help__faq::before { content: ""; position: absolute; top: 20px; left: 7px; width: 4px; height: 25px; border-radius: 2px; background: color-mix(in srgb, var(--v1-brand) 45%, var(--v1-surface)); }
.v1-info-help__faq h3 { font-size: inherit; }
.v1-info-help__faq h3 button { width: 100%; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 22px; text-align: left; font-size: 15px; font-weight: 500; }
.v1-info-help__chevron { color: var(--v1-brand); font-size: 18px; line-height: 1; }
.v1-info-help__faq.is-open .v1-info-help__chevron { transform: rotate(180deg); }
.v1-info-help__answer { padding: 0 22px 20px; color: var(--v1-muted); font-size: 14px; line-height: 1.75; }
.v1-info-help__answer p + p { margin-top: 12px; }
.v1-info-help__empty { min-height: 220px; padding: 32px 24px; border: 1px solid var(--v1-border); border-radius: 16px; text-align: left; background: var(--v1-bg); }
.v1-info-help__empty p { margin: 10px 0; color: var(--v1-muted); }
.v1-info-help__empty button { min-height: 44px; color: var(--v1-brand); font-weight: 700; }
.v1-info-help__topics { min-height: 510px; padding: 26px 19px 20px; border-radius: 22px; background: var(--v1-brand-soft); }
.v1-info-help__topics-title { display: flex; align-items: center; gap: 11px; padding-left: 5px; }
.v1-info-help__topics-title img, .v1-info-help__topic-list img { width: 24px; height: 24px; }
.v1-info-help__topics-title h3 { font-size: 22px; }
.v1-info-help__topics-label { margin: 22px 5px 16px; color: var(--v1-brand) !important; font-size: 12px; font-weight: 600; }
.v1-info-help__topic-list { display: grid; gap: 14px; }
.v1-info-help__topic-list button, .v1-info-help__topic-list a { width: 100%; min-height: 63px; display: flex; align-items: center; gap: 16px; padding: 0 17px; border-radius: 15px; background: var(--v1-surface); text-align: left; font-size: 15px; font-weight: 500; }
.v1-info-help__topic-list button span:nth-child(2), .v1-info-help__topic-list a span:nth-child(2) { flex: 1; }
.v1-info-help__topic-list button span:last-child, .v1-info-help__topic-list a span:last-child { color: var(--v1-brand); font-size: 18px; }
.v1-info-help__topics-hint { margin: 47px 3px 0; color: var(--v1-muted) !important; font-size: 12px; }
.v1-info-help__contact { margin-top: 83px; min-height: 190px; padding: 26px 22px; border-radius: 20px; background: var(--v1-brand-soft); }
.v1-info-help__contact h2 { font-size: 21px; }
.v1-info-help__contact p { margin: 18px 0 13px; color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-info-help__contact :deep(.btn) { min-width: 205px; min-height: 52px; border-radius: 14px; background: var(--v1-brand); color: var(--v1-on-brand); }
.v1-info-help__useful { margin-top: 28px; padding: 26px 22px 29px; border-radius: 25px; background: var(--v1-bg); }
.v1-info-help__useful h2 { margin-top: 19px; font-size: 27px; line-height: 38px; }
.v1-info-help__useful-intro { margin-top: 7px; color: var(--v1-muted) !important; font-size: 13px; line-height: 20px; }
.v1-info-help__useful-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 17px; margin-top: 35px; }
.v1-info-help__useful-card { padding: 16px 18px 20px; border-radius: 17px; background: var(--v1-surface); }
.v1-info-help__useful-card h3 { margin-bottom: 16px; font-size: 17px; }
.v1-info-help__useful-row { display: flex; align-items: center; gap: 13px; min-height: 43px; margin-top: 8px; padding: 5px 7px; border-radius: 12px; background: var(--v1-brand-soft); font-size: 14px; font-weight: 500; }
.v1-info-help__useful-row:nth-of-type(2) { background: var(--v1-tint-sky, var(--v1-bg)); }
.v1-info-help__useful-row:nth-of-type(3) { background: var(--v1-tint-mint, var(--v1-bg)); }
.v1-info-help__useful-row > span { display: grid; place-items: center; flex: 0 0 46px; min-height: 29px; border-radius: 11px; background: var(--v1-surface); color: var(--v1-brand); font: 600 12px/1 var(--v1-font-display); }
.v1-info-help__steps .v1-info-help__useful-row { background: var(--v1-bg); font-weight: 700; }
.v1-info-help__steps .v1-info-help__useful-row:first-of-type { background: var(--v1-brand-soft); }
.v1-info-help__steps .v1-info-help__useful-row > span { background: transparent; }
:global(html[data-theme="high-contrast"]) .v1-info-help__search,
:global(html[data-theme="high-contrast"]) .v1-info-help__topics,
:global(html[data-theme="high-contrast"]) .v1-info-help__contact,
:global(html[data-theme="high-contrast"]) .v1-info-help__useful,
:global(html[data-theme="high-contrast"]) .v1-info-help__useful-card { border: 1px solid var(--v1-border); }
:global(html[data-theme="high-contrast"]) .v1-info-help__categories button { border: 1px solid var(--v1-border); }
:global(html[data-theme="high-contrast"]) .v1-info-help__useful-row > span { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
  .v1-info-help__hero-inner { height: 300px; }
  .v1-info-help__hero-copy { padding-top: 33px; }
  .v1-info-help__hero h1 { margin-top: 29px; font-size: 32px; line-height: 44px; }
  .v1-info-help__lead { max-width: 100%; margin-top: 59px; font-size: 14px; line-height: 24px; }
  .v1-info-help__hero-line { position: absolute; top: 286px; left: 0; width: 78px; height: 3px; margin: 0; background: color-mix(in srgb, var(--v1-decor-lilac, var(--v1-brand)) 45%, transparent); }
  .v1-info-help__hero-art { width: 180px; right: -24px; }
  .v1-info-help__desktop-art, .v1-info-help__hero-ellipse { display: none; }
  .v1-info-help__mobile-art { display: block; }
  .v1-info-help__mobile-glow { position: absolute; width: 110px; height: 110px; right: -16px; top: 45px; }
  .v1-info-help__mobile-orbit { position: absolute; width: 89px; height: 89px; right: 10px; top: 58px; }
  .v1-info-help__hero-card { top: 27px; right: 23px; width: 54px; height: 54px; padding: 15px; border-radius: 16px; }
  .v1-info-help__hero-card-content { height: 24px; padding: 0; border-radius: 0; background: transparent; }
  .v1-info-help__hero-card p, .v1-info-help__hero-card strong, .v1-info-help__hero-card span, .v1-info-help__hero-caption { display: none; }
  .v1-info-help__mobile-caption { display: block; position: absolute; left: 0; bottom: 24px; color: color-mix(in srgb, var(--v1-decor-lilac, var(--v1-brand)) 45%, transparent); font: 600 11px/1 var(--v1-font-display); }
  .v1-info-help__body { padding-top: 50px; }
  .v1-info-help__categories { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
  .v1-info-help__categories button { width: auto; padding: 0 2px; white-space: nowrap; font-size: 13px; }
  .v1-info-help__faq-title { margin: 39px 0 38px; font-size: 23px; }
  .v1-info-help__faq-layout { display: block; }
  .v1-info-help__topics { display: none; }
  .v1-info-help__faqs { gap: 10px; }
  .v1-info-help__faq h3 button { font-size: 14px; }
  .v1-info-help__contact { margin-top: 24px; min-height: 218px; padding: 26px 22px; }
  .v1-info-help__contact p { margin: 18px 0 18px; }
  .v1-info-help__contact :deep(.btn) { min-width: 181px; }
  .v1-info-help__useful { padding: 19px 15px 24px; }
  .v1-info-help__useful h2 { margin-top: 19px; font-size: 20px; line-height: 29px; }
  .v1-info-help__useful-intro { margin-top: 10px; }
  .v1-info-help__useful-grid { grid-template-columns: 1fr; gap: 20px; margin-top: 24px; }
  .v1-info-help__useful-card { padding: 12px; }
  .v1-info-help__useful-card h3 { display: none; }
  .v1-info-help__useful-row { min-height: 30px; margin-top: 5px; padding: 0; background: transparent !important; font-size: 12px; }
  .v1-info-help__useful-row:first-of-type { margin-top: 0; }
  .v1-info-help__useful-row > span { flex-basis: 40px; min-height: 30px; background: var(--v1-brand-soft); }
  .v1-info-help__useful-card:not(.v1-info-help__steps) .v1-info-help__useful-row:nth-of-type(2) > span { background: var(--v1-tint-sky, var(--v1-brand-soft)); }
  .v1-info-help__useful-card:not(.v1-info-help__steps) .v1-info-help__useful-row:nth-of-type(3) > span { background: var(--v1-tint-mint, var(--v1-brand-soft)); }
  .v1-info-help__steps .v1-info-help__useful-row { min-height: 32px; font-size: 13px; }
  .v1-info-help__steps .v1-info-help__useful-row > span { flex-basis: 27px; }
  .v1-info-help__steps .v1-info-help__useful-row:first-of-type { color: var(--v1-brand); }
  .v1-info-help__steps .v1-info-help__useful-row:not(:first-of-type) > span { color: var(--v1-text); }
}
@media (max-width: 360px) {
  .v1-info-help__categories button { font-size: 12px; }
}
</style>
