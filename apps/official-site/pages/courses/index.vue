<script setup lang="ts">
import { directions, directionTextKey, type Direction, type DirectionGroup } from "~/components/v1/core/catalog";
import { useOfficialSeo } from "~/utils/seo";

const { t } = useSiteText();
const route = useRoute();
const router = useRouter();
const { loadState, getFacet, load } = usePublicProjection("courses");
const { registerLink, authLink } = useOfficialSiteLinks();
const coursesFacet = computed(() => getFacet("courses"));
const canShowCourses = computed(() => ["ready", "recovery"].includes(coursesFacet.value.state));
const publicCourses = computed(() => canShowCourses.value ? loadState.value.projection.courses : []);
const coursesEmpty = computed(() => coursesFacet.value.state === "empty" ||
  (coursesFacet.value.state === "ready" && publicCourses.value.length === 0));
const coursesStatus = computed(() => coursesEmpty.value ? "empty" : coursesFacet.value.state);
const groupOptions: DirectionGroup[] = ["all", "words", "understand", "express"];
const queryText = (value: unknown) => typeof value === "string" ? value : "";
const readGroup = (value: unknown): DirectionGroup =>
  groupOptions.includes(value as DirectionGroup) ? value as DirectionGroup : "all";
const group = ref<DirectionGroup>(readGroup(route.query.group));
const query = ref(queryText(route.query.q));
const resultsHeading = ref<HTMLElement | null>(null);
watch(() => [route.query.group, route.query.q], ([nextGroup, nextQuery]) => {
  group.value = readGroup(nextGroup);
  query.value = queryText(nextQuery);
});
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return directions.filter((direction) =>
    (group.value === "all" || group.value === direction.group) &&
    [t(directionTextKey(direction, "title")), t(directionTextKey(direction, "short")), t(directionTextKey(direction, "searchTerms")), t(`official.v1.core.goals.${direction.goal}`)]
      .join(" ").toLocaleLowerCase().includes(term),
  );
});
function setFilter(nextGroup: DirectionGroup, nextQuery = query.value) {
  group.value = nextGroup;
  query.value = nextQuery;
  void router.replace({ query: { ...route.query, group: nextGroup === "all" ? undefined : nextGroup, q: nextQuery || undefined } });
}
function chooseGoal(direction: Direction) {
  setFilter(direction.group, t(directionTextKey(direction, "title")));
  void nextTick(() => {
    resultsHeading.value?.scrollIntoView({ behavior: "auto", block: "start" });
    resultsHeading.value?.focus({ preventScroll: true });
  });
}
useOfficialSeo({
  title: t("official.v1.core.catalog.seoTitle"),
  description: t("official.v1.core.catalog.seoDescription"),
  path: "/courses",
});
</script>

<template>
  <div class="v1-core-catalog">
    <section class="v1-core-catalog__hero" aria-labelledby="catalog-title">
      <div class="v1-core-container v1-core-catalog__hero-inner">
        <div class="v1-core-catalog__hero-copy">
          <p class="v1-core-catalog__eyebrow">{{ t("official.v1.core.catalog.eyebrow") }}</p>
          <h1 id="catalog-title">{{ t("official.v1.core.catalog.title") }}</h1>
          <p class="v1-core-catalog__lead">{{ t("official.v1.core.catalog.lead") }}</p>
          <span class="v1-core-catalog__mobile-caption" aria-hidden="true">{{ t("official.v1.core.catalog.heroCaption") }}</span>
          <span class="v1-core-catalog__hero-rule" aria-hidden="true" />
        </div>
        <div class="v1-core-catalog__hero-art" aria-hidden="true">
          <div class="v1-core-catalog__art-card">
            <div class="v1-core-catalog__art-face">
              <img src="/figma-v1/assets/courses-desktop-168-682/imgEllipse.svg" width="158" height="158" alt="" class="v1-core-catalog__art-ellipse" />
              <img src="/figma-v1/assets/courses-desktop-168-682/imgFrame.svg" width="24" height="24" alt="" />
              <span>{{ t("official.v1.core.catalog.heroEyebrow") }}</span>
              <strong>{{ t("official.v1.core.catalog.heroTitle") }}</strong>
              <i /><small>{{ t("official.v1.core.catalog.heroCount") }}</small>
            </div>
          </div>
          <img class="v1-core-catalog__orbit" src="/figma-v1/assets/courses-desktop-168-682/imgBrandOrbitMotionPath.svg" width="275" height="275" alt="" />
          <img class="v1-core-catalog__orb" src="/figma-v1/assets/courses-desktop-168-682/imgAmbientPastelOrb.svg" width="157" height="157" alt="" />
          <img class="v1-core-catalog__glimmer" src="/figma-v1/assets/courses-desktop-168-682/imgAmbientGlimmer.svg" width="18" height="18" alt="" />
          <span class="v1-core-catalog__art-caption">{{ t("official.v1.core.catalog.heroCaption") }}</span>
          <span class="v1-core-catalog__sparkle">✦</span>
        </div>
        <div class="v1-core-catalog__hero-mobile-art" aria-hidden="true">
          <span class="v1-core-catalog__mobile-icon"><img src="/figma-v1/assets/courses-mobile-168-872/imgFrame.svg" width="24" height="24" alt="" /></span>
          <img class="v1-core-catalog__mobile-ellipse" src="/figma-v1/assets/courses-mobile-168-872/imgEllipse.svg" width="90" height="90" alt="" />
          <img class="v1-core-catalog__mobile-orbit" src="/figma-v1/assets/courses-mobile-168-872/imgBrandOrbitMotionPath.svg" width="131" height="131" alt="" />
          <img class="v1-core-catalog__mobile-orbit-small" src="/figma-v1/assets/courses-mobile-168-872/imgBrandOrbitMotionPath1.svg" width="95" height="95" alt="" />
          <img class="v1-core-catalog__mobile-light" src="/figma-v1/assets/courses-mobile-168-872/imgAmbientPastelLight.svg" width="79" height="79" alt="" />
          <span>✦</span>
        </div>
      </div>
    </section>

    <section class="v1-core-container v1-core-catalog__body" :aria-label="t('official.v1.core.catalog.directionsLabel')">
      <div class="v1-core-catalog__filters" role="group" :aria-label="t('official.v1.core.catalog.filterLabel')">
        <button v-for="option in groupOptions" :key="option" type="button" :aria-pressed="group === option" @click="setFilter(option)">
          {{ t(`official.v1.core.catalog.${option}`) }}
        </button>
      </div>
      <label class="v1-core-catalog__search">
        <SiteIcon name="search" />
        <input :value="query" type="search" :placeholder="t('official.v1.core.catalog.search')" :aria-label="t('official.v1.core.catalog.search')" @input="setFilter(group, ($event.target as HTMLInputElement).value)" />
        <button v-if="query" type="button" :aria-label="t('official.v1.core.catalog.clearSearch')" @click="setFilter(group, '')"><SiteIcon name="close" /></button>
      </label>
      <h2 ref="resultsHeading" class="v1-core-sr-only" tabindex="-1">{{ t("official.v1.core.catalog.filterLabel") }}</h2>
      <p class="v1-core-sr-only" aria-live="polite">{{ t("official.v1.core.catalog.resultCount", { count: filtered.length }) }}</p>
      <div v-if="filtered.length" class="v1-core-catalog__grid">
        <article v-for="direction in filtered" :key="direction.id" class="v1-core-catalog__card" :data-tone="direction.tone">
          <div class="v1-core-catalog__card-title">
            <h3>{{ t(directionTextKey(direction, "title")) }}</h3>
            <span class="v1-core-catalog__card-icon" aria-hidden="true"><img src="/figma-v1/assets/courses-desktop-168-682/imgFrame.svg" width="24" height="24" alt="" /></span>
          </div>
          <p>{{ t(directionTextKey(direction, "short")) }}</p>
          <NuxtLink :to="`/courses/${direction.id}`">{{ t(directionTextKey(direction, "action")) }}<span aria-hidden="true">→</span></NuxtLink>
        </article>
      </div>
      <div v-else class="v1-core-catalog__no-results" role="status">
        <h3>{{ t("official.v1.core.catalog.noResults") }}</h3>
        <p>{{ t("official.v1.core.catalog.noResultsNote") }}</p>
        <button type="button" @click="setFilter('all', '')">{{ t("official.v1.core.catalog.resetFilters") }}</button>
      </div>
      <p class="v1-core-catalog__note">{{ t("official.v1.core.catalog.note") }} <span>{{ t("official.v1.core.catalog.directionBoundary") }}</span></p>

      <section class="v1-core-catalog__goals" aria-labelledby="goals-title">
        <p class="v1-core-catalog__eyebrow">{{ t("official.v1.core.catalog.goalsEyebrow") }}</p>
        <h2 id="goals-title">{{ t("official.v1.core.catalog.goalsTitle") }}</h2>
        <p class="v1-core-catalog__goals-lead">{{ t("official.v1.core.catalog.goalsLead") }}</p>
        <div class="v1-core-catalog__goal-columns">
          <div class="v1-core-catalog__goal-panel">
            <h3>{{ t("official.v1.core.catalog.goalsQuestion") }}</h3>
            <div class="v1-core-catalog__goal-buttons">
              <button v-for="direction in directions" :key="direction.id" type="button" :data-tone="direction.tone" @click="chooseGoal(direction)">{{ t(`official.v1.core.goals.${direction.goal}`) }}</button>
            </div>
            <p>{{ t("official.v1.core.catalog.goalsNote") }}</p>
          </div>
          <div class="v1-core-catalog__path-panel">
            <h3>{{ t("official.v1.core.catalog.pathTitle") }}</h3>
            <ol>
              <li v-for="step in 3" :key="step"><span>{{ String(step).padStart(2, '0') }}</span><div><strong>{{ t(`official.v1.core.catalog.path${step}`) }}</strong><small>{{ t(`official.v1.core.catalog.path${step}Note`) }}</small></div></li>
            </ol>
          </div>
        </div>
      </section>

      <section class="v1-core-catalog__published" aria-labelledby="published-courses-title">
        <h2 id="published-courses-title">{{ t("official.v1.core.catalog.publishedTitle") }}</h2>
        <p>{{ t("official.v1.core.catalog.publishedLead") }}</p>
        <PublicStatus v-if="coursesFacet.state !== 'ready' || coursesEmpty" :state="coursesStatus" :title="coursesEmpty ? t('official.v1.core.catalog.publishedEmpty') : undefined" :message="coursesEmpty ? t('official.v1.core.catalog.publishedEmptyNote') : undefined" :action-label="coursesEmpty ? t('official.v1.core.catalog.publishedRegister') : undefined" :action-href="coursesEmpty ? registerLink() : undefined" @retry="load" />
        <div v-if="publicCourses.length" class="v1-core-catalog__published-grid">
          <article v-for="course in publicCourses" :key="course.id">
            <span v-if="course.level">{{ course.level }}</span>
            <h3>{{ course.title }}</h3><p v-if="course.description">{{ course.description }}</p>
            <NuxtLink :to="authLink('/courses')" external>{{ t("official.v1.core.catalog.publishedAction") }} <span aria-hidden="true">→</span></NuxtLink>
          </article>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
.v1-core-catalog { background: var(--v1-surface); color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-core-container { width: min(1192px, calc(100% - 48px)); margin-inline: auto; }
.v1-core-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.v1-core-catalog__hero { overflow: hidden; background: linear-gradient(100deg, var(--v1-hero-from), var(--v1-hero-to)); }
.v1-core-catalog__hero-inner { min-height: 338px; position: relative; }
.v1-core-catalog__hero-copy { position: relative; z-index: 2; padding-top: 32px; }
.v1-core-catalog__eyebrow { color: var(--v1-brand); font-family: var(--v1-font-display); font-weight: 600; font-size: 13px; line-height: 1.3; }
.v1-core-catalog__hero h1 { margin: 35px 0 36px; max-width: 750px; font-size: 48px; font-weight: 900; line-height: 1.33; }
.v1-core-catalog__lead { color: var(--v1-muted); font-size: 17px; line-height: 31px; }
.v1-core-catalog__hero-rule { display: block; width: 184px; height: 3px; border-radius: 2px; background: var(--v1-brand); opacity: .25; position: absolute; top: 300px; left: 0; }
.v1-core-catalog__hero-art { position: absolute; z-index: 1; top: 0; right: 0; width: 368px; height: 338px; }
.v1-core-catalog__art-card { position: absolute; top: 67px; left: -8px; width: 368px; height: 220px; padding: 18px; border-radius: 24px; background: var(--v1-surface); }
.v1-core-catalog__art-face { position: relative; height: 184px; overflow: hidden; border-radius: 19px; padding: 20px 21px; background: var(--v1-brand-soft); color: var(--v1-brand); }
.v1-core-catalog__art-face > img:not(.v1-core-catalog__art-ellipse) { position: relative; z-index: 1; }
.v1-core-catalog__art-face > span { display: block; margin-top: 26px; font: 600 13px/1.2 var(--v1-font-display); }
.v1-core-catalog__art-face strong { display: block; margin-top: 8px; color: var(--v1-text); font-size: 23px; }
.v1-core-catalog__art-face i { display: inline-block; position: relative; width: 124px; height: 6px; margin-top: 14px; border-radius: 4px; background: var(--v1-surface); }
.v1-core-catalog__art-face i::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 84px; border-radius: inherit; background: var(--v1-brand); }
.v1-core-catalog__art-face small { position: absolute; left: 165px; bottom: 24px; font-size: 12px; white-space: nowrap; }
.v1-core-catalog__art-ellipse { position: absolute; top: -38px; left: 188px; }
.v1-core-catalog__orbit { position: absolute; left: 206px; top: -66px; }
.v1-core-catalog__orb { position: absolute; left: 166px; top: 156px; }
.v1-core-catalog__glimmer { position: absolute; left: 124px; top: 28px; }
.v1-core-catalog__art-caption { position: absolute; top: 261px; left: 19px; color: var(--v1-brand); opacity: .23; font: 600 31px/1 var(--v1-font-display); }
.v1-core-catalog__sparkle { position: absolute; top: 183px; left: 371px; width: 79px; color: var(--v1-brand); opacity: .32; font-size: 39px; line-height: 1; }
.v1-core-catalog__hero-mobile-art, .v1-core-catalog__mobile-caption { display: none; }
.v1-core-catalog__body { padding: 52px 0 40px; }
.v1-core-catalog__filters { display: flex; gap: 12px; }
.v1-core-catalog__filters button { width: 118px; min-height: 44px; border-radius: 20px; background: var(--v1-brand-soft); color: var(--v1-brand); font-size: 14px; font-weight: 500; }
.v1-core-catalog__filters button[aria-pressed="true"] { background: var(--v1-brand); color: var(--v1-on-brand); }
.v1-core-catalog__search { display: flex; align-items: center; gap: 9px; height: 54px; margin-top: 21px; padding: 0 18px; border-radius: 15px; background: color-mix(in srgb, var(--v1-brand-soft) 25%, var(--v1-surface)); color: var(--v1-muted); }
.v1-core-catalog__search .icon { width: 16px; height: 16px; }
.v1-core-catalog__search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--v1-text); font-size: 15px; }
.v1-core-catalog__search input:focus-visible { outline: 2px solid var(--v1-focus); outline-offset: 3px; }
.v1-core-catalog__search button { display: grid; place-items: center; min-width: 44px; min-height: 44px; }
.v1-core-catalog__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 32px; }
.v1-core-catalog__card { position: relative; min-width: 0; min-height: 178px; padding: 19px; border: 1px solid var(--v1-border); border-radius: 20px; background: color-mix(in srgb, var(--v1-brand-soft) 35%, var(--v1-surface)); }
.v1-core-catalog__card[data-tone="sage"] { background: color-mix(in srgb, var(--v1-tint-mint) 55%, var(--v1-surface)); }
.v1-core-catalog__card[data-tone="apricot"] { background: color-mix(in srgb, var(--v1-warning-bg) 55%, var(--v1-surface)); }
.v1-core-catalog__card[data-tone="blue"] { background: color-mix(in srgb, var(--v1-tint-sky) 55%, var(--v1-surface)); }
.v1-core-catalog__card::before { content: ""; position: absolute; left: -1px; top: 18px; height: 22px; width: 3px; border-radius: 2px; background: var(--v1-brand); opacity: .65; }
.v1-core-catalog__card[data-tone="sage"]::before { background: var(--v1-success-fg); }
.v1-core-catalog__card[data-tone="apricot"]::before { background: var(--v1-warning-fg); }
.v1-core-catalog__card-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.v1-core-catalog__card h3 { font-size: 21px; line-height: 29px; }
.v1-core-catalog__card-icon { display: grid; place-items: center; flex: 0 0 42px; width: 42px; height: 42px; margin: -7px -7px -5px 0; border-radius: 13px; background: var(--v1-surface); }
.v1-core-catalog__card p { min-height: 40px; margin-top: 13px; padding-bottom: 9px; border-bottom: 1px solid var(--v1-border); color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-core-catalog__card a { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; margin-top: 13px; padding: 0 15px 0 16px; border-radius: 12px; background: var(--v1-surface); color: var(--v1-brand); font-size: 13px; font-weight: 500; }
.v1-core-catalog__card a span { font: 600 19px var(--v1-font-display); }
.v1-core-catalog__note { margin-top: 23px; padding: 17px 18px; border-radius: 17px; background: var(--v1-brand-soft); color: var(--v1-text); font-size: 14px; line-height: 24px; }
.v1-core-catalog__note span { color: var(--v1-muted); }
.v1-core-catalog__no-results { width: min(762px, 100%); min-height: 176px; margin-top: 32px; padding: 30px 23px 12px; border: 1px solid var(--v1-border); border-radius: 18px; background: var(--v1-surface); }
.v1-core-catalog__no-results h3 { font-size: 19px; }
.v1-core-catalog__no-results p { min-height: 36px; margin-top: 18px; color: var(--v1-muted); font-size: 14px; line-height: 1.5; }
.v1-core-catalog__no-results button { display: block; width: 100%; min-height: 48px; margin-top: 4px; padding: 0 16px; border-radius: 12px; background: var(--v1-brand); color: var(--v1-on-brand); text-align: left; font-size: 15px; font-weight: 700; }
.v1-core-catalog__goals { margin-top: 28px; padding: 24px 22px 26px; border-radius: 25px; background: color-mix(in srgb, var(--v1-brand-soft) 25%, var(--v1-surface)); }
.v1-core-catalog__goals > .v1-core-catalog__eyebrow, .v1-core-catalog__goals > h2, .v1-core-catalog__goals-lead { margin-left: 6px; }
.v1-core-catalog__goals > h2 { margin-top: 16px; font-size: 29px; }
.v1-core-catalog__goals-lead { margin-top: 10px; color: var(--v1-muted); font-size: 13px; }
.v1-core-catalog__goal-columns { display: grid; grid-template-columns: 1fr 1.03fr; gap: 18px; margin-top: 27px; }
.v1-core-catalog__goal-panel, .v1-core-catalog__path-panel { min-width: 0; min-height: 243px; padding: 16px 18px; border-radius: 18px; background: var(--v1-surface); }
.v1-core-catalog__goal-panel h3 { font-size: 15px; }
.v1-core-catalog__goal-buttons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; margin-top: 14px; }
.v1-core-catalog__goal-buttons button { min-width: 0; min-height: 44px; padding: 4px; border-radius: 12px; background: var(--v1-brand-soft); color: var(--v1-brand); font-size: 13px; }
.v1-core-catalog__goal-buttons button[data-tone="sage"] { background: var(--v1-tint-mint); }
.v1-core-catalog__goal-buttons button[data-tone="apricot"], .v1-core-catalog__goal-buttons button[data-tone="blue"] { background: var(--v1-tint-sky); }
.v1-core-catalog__goal-panel > p { margin-top: 42px; color: var(--v1-muted); font-size: 12px; }
.v1-core-catalog__path-panel h3 { font-size: 19px; }
.v1-core-catalog__path-panel ol { display: grid; gap: 12px; margin: 16px 0 0; padding: 0; list-style: none; }
.v1-core-catalog__path-panel li { display: flex; align-items: flex-start; gap: 14px; }
.v1-core-catalog__path-panel li > span { display: grid; place-items: center; width: 49px; min-height: 35px; flex: 0 0 49px; border-radius: 12px; background: var(--v1-brand-soft); color: var(--v1-brand); font: 500 13px var(--v1-font-display); }
.v1-core-catalog__path-panel li strong, .v1-core-catalog__path-panel li small { display: block; }
.v1-core-catalog__path-panel li strong { font-size: 15px; }
.v1-core-catalog__path-panel li small { margin-top: 4px; color: var(--v1-muted); font-size: 12px; }
.v1-core-catalog__published { margin-top: 40px; }
.v1-core-catalog__published > h2 { font-size: 25px; }
.v1-core-catalog__published > p { margin: 8px 0 20px; color: var(--v1-muted); font-size: 14px; }
.v1-core-catalog__published-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
.v1-core-catalog__published-grid article { min-width: 0; padding: 20px; border: 1px solid var(--v1-border); border-radius: 18px; background: var(--v1-surface); overflow-wrap: anywhere; }
.v1-core-catalog__published-grid article > span { color: var(--v1-brand); font-size: 12px; }
.v1-core-catalog__published-grid h3 { margin: 8px 0; font-size: 20px; }
.v1-core-catalog__published-grid p { color: var(--v1-muted); }
.v1-core-catalog__published-grid a { display: inline-flex; align-items: center; gap: 12px; min-height: 44px; margin-top: 12px; color: var(--v1-brand); }
.v1-core-catalog :is(button, a, input):focus-visible { outline-color: var(--v1-focus); }
:global(:root[data-theme="high-contrast"]) .v1-core-catalog__goal-buttons button, :global(:root[data-theme="high-contrast"]) .v1-core-catalog__filters button { border: 1px solid var(--v1-border); }
@media (max-width: 850px) {
  .v1-core-catalog__hero h1 { max-width: 58%; font-size: 38px; }
  .v1-core-catalog__hero-art { transform: scale(.75); transform-origin: right center; }
  .v1-core-catalog__grid, .v1-core-catalog__published-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .v1-core-catalog__hero-inner { min-height: 315px; }
  .v1-core-catalog__hero-copy { padding-top: 31px; }
  .v1-core-catalog__hero h1 { max-width: 342px; margin: 29px 0 0; font-size: 31px; line-height: 45px; }
  .v1-core-catalog__lead { position: absolute; top: 189px; left: 0; max-width: 342px; font-size: 14px; line-height: 26px; }
  .v1-core-catalog__mobile-caption { display: block; position: absolute; top: 263px; left: 1px; color: var(--v1-brand); opacity: .55; font: 600 11px/1 var(--v1-font-display); }
  .v1-core-catalog__hero-rule { top: 283px; width: 74px; opacity: .33; }
  .v1-core-catalog__hero-art { display: none; }
  .v1-core-catalog__hero-mobile-art { display: block; position: absolute; top: 0; right: -24px; width: 150px; height: 315px; }
  .v1-core-catalog__mobile-icon { position: absolute; top: 26px; right: 24px; display: grid; place-items: center; width: 54px; height: 54px; border-radius: 17px; background: var(--v1-surface); }
  .v1-core-catalog__mobile-ellipse { position: absolute; right: -57px; top: 100px; }
  .v1-core-catalog__mobile-orbit { position: absolute; right: -4px; top: 154px; }
  .v1-core-catalog__mobile-orbit-small { position: absolute; right: 9px; top: 174px; }
  .v1-core-catalog__mobile-light { position: absolute; right: -9px; top: 32px; }
  .v1-core-catalog__hero-mobile-art > span:last-child { position: absolute; left: 66px; top: 59px; width: 48px; color: var(--v1-brand); opacity: .65; font-size: 27px; line-height: 1; }
  .v1-core-catalog__body { padding-top: 43px; }
  .v1-core-catalog__filters { gap: 8px; }
  .v1-core-catalog__filters button { width: auto; flex: 1; min-width: 0; }
  .v1-core-catalog__grid, .v1-core-catalog__published-grid { grid-template-columns: 1fr; gap: 12px; }
  .v1-core-catalog__card { min-height: 176px; border-radius: 16px; }
  .v1-core-catalog__card-icon { display: none; }
  .v1-core-catalog__no-results { margin-bottom: 188px; }
  .v1-core-catalog__note { min-height: 73px; padding: 15px 18px; }
  .v1-core-catalog__goals { padding: 20px 15px 32px; }
  .v1-core-catalog__goals > .v1-core-catalog__eyebrow, .v1-core-catalog__goals > h2, .v1-core-catalog__goals-lead { margin-left: 2px; }
  .v1-core-catalog__goals > h2 { margin-top: 16px; font-size: 23px; }
  .v1-core-catalog__goal-columns { grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
  .v1-core-catalog__goal-panel, .v1-core-catalog__path-panel { min-height: 0; padding: 15px 16px; border-radius: 17px; }
  .v1-core-catalog__goal-buttons { gap: 8px; }
  .v1-core-catalog__goal-buttons button { font-size: 12px; }
  .v1-core-catalog__goal-panel > p { margin-top: 16px; }
  .v1-core-catalog__path-panel ol { gap: 10px; }
  .v1-core-catalog__path-panel li > span { width: 28px; flex-basis: 28px; min-height: 28px; }
  .v1-core-catalog__path-panel li strong { display: inline; font-size: 13px; }
  .v1-core-catalog__path-panel li small { display: inline; margin-left: 8px; }
}
@media (prefers-reduced-motion: reduce) { .v1-core-catalog * { scroll-behavior: auto; } }
</style>
