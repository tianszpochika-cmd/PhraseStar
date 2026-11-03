<script setup lang="ts">
import InfoHero from "~/components/v1/info/InfoHero.vue";
import InfoUseful from "~/components/v1/info/InfoUseful.vue";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const { publicLink } = useOfficialSiteLinks();
const { loadState, load, getFacet } = usePublicProjection("announcements");
const facet = computed(() => getFacet("announcements"));
const canShow = computed(() => ["ready", "recovery"].includes(facet.value.state));
const announcements = computed(() => canShow.value ? loadState.value.projection.announcements : []);
const desktopAssets = "/figma-v1/assets/announcements-desktop-168-2830";
const mobileAssets = "/figma-v1/assets/announcements-mobile-168-2930";
useOfficialSeo({ title: t("official.v1.info.announcements.seoTitle"), description: t("official.v1.info.announcements.lead"), path: "/announcements" });
</script>
<template>
  <div class="v1-info-announcements">
    <InfoHero :eyebrow="t('official.v1.info.announcements.eyebrow')" :title="t('official.v1.info.announcements.title')" :lead="t('official.v1.info.announcements.lead')" :caption="t('official.v1.info.announcements.caption')" :card-label="t('official.v1.info.announcements.cardLabel')" :card-title="t('official.v1.info.announcements.title')" :desktop-assets="desktopAssets" :mobile-assets="mobileAssets" tone="sky" />
    <div class="v1-info-announcements__body"><div class="v1-info-announcements__container">
      <section class="v1-info-announcements__intro">
        <p class="v1-info-announcements__eyebrow">{{ t("official.v1.info.announcements.cardLabel") }}</p>
        <h2>{{ t("official.v1.info.announcements.headerTitle") }}</h2>
        <p>{{ t("official.v1.info.announcements.headerText") }}</p>
      </section>
      <p v-if="facet.state === 'recovery'" class="v1-info-announcements__recovery" role="status">
        {{ t("official.v1.info.announcements.recovery") }}
        <span v-if="facet.updatedAt">{{ t("official.v1.info.announcements.updated") }}{{ facet.updatedAt.slice(0, 10) }}</span>
        <button type="button" @click="load">{{ t("official.v1.info.announcements.retry") }}</button>
      </p>
      <p v-else-if="facet.updatedAt && facet.state === 'ready'" class="v1-info-announcements__updated">{{ t("official.v1.info.announcements.updated") }}{{ facet.updatedAt.slice(0, 10) }}</p>
      <div v-if="announcements.length" class="v1-info-announcements__cards">
        <article v-for="item in announcements" :key="item.id" class="v1-info-announcements__card">
          <h2>{{ item.title }}</h2>
          <p>{{ item.summary }}</p>
          <time v-if="item.publishedAt" :datetime="item.publishedAt" class="v1-info-announcements__chip">{{ item.publishedAt.slice(0, 10) }}</time>
          <span v-else class="v1-info-announcements__chip">{{ t("official.v1.info.announcements.noDate") }}</span>
          <a v-if="publicLink(item.href)" class="v1-info-announcements__link" :href="publicLink(item.href)!"><span>{{ t("official.v1.info.announcements.read") }}</span> →</a>
          <picture class="v1-info-announcements__icon" aria-hidden="true"><source media="(max-width: 800px)" :srcset="`${mobileAssets}/imgFrame.svg`" /><img :src="`${desktopAssets}/imgFrame.svg`" alt="" /></picture>
          <span class="v1-info-announcements__rule" aria-hidden="true"></span>
        </article>
      </div>
      <article v-else-if="canShow || facet.state === 'empty'" class="v1-info-announcements__card v1-info-announcements__empty" role="status">
        <h2>{{ t("official.v1.info.announcements.empty") }}</h2>
        <p>{{ t("official.v1.info.announcements.emptyText") }}</p>
        <span class="v1-info-announcements__chip">{{ t("official.v1.info.announcements.pending") }}</span>
        <picture class="v1-info-announcements__icon" aria-hidden="true"><source media="(max-width: 800px)" :srcset="`${mobileAssets}/imgFrame1.svg`" /><img :src="`${desktopAssets}/imgFrame1.svg`" alt="" /></picture>
        <span class="v1-info-announcements__rule" aria-hidden="true"></span>
      </article>
      <PublicStatus v-else :state="facet.state" @retry="load" />
      <InfoUseful class="v1-info-announcements__useful" :eyebrow="t('official.v1.info.announcements.usefulLabel')" :title="t('official.v1.info.announcements.usefulTitle')" :intro="t('official.v1.info.announcements.usefulText')" :entries="[t('official.v1.info.announcements.entry1'), t('official.v1.info.announcements.entry2'), t('official.v1.info.announcements.entry3')]" :steps="[t('official.v1.info.announcements.step1'), t('official.v1.info.announcements.step2'), t('official.v1.info.announcements.step3')]" />
    </div></div>
  </div>
</template>
<style scoped>
.v1-info-announcements { color: var(--v1-text); font-family: var(--v1-font-sans); }
.v1-info-announcements p { color: inherit; }
.v1-info-announcements :is(a, button):focus-visible { outline: 3px solid var(--v1-focus); outline-offset: 3px; }
.v1-info-announcements__body { padding: 68px 0 40px; background: var(--v1-surface); }
.v1-info-announcements__container { width: min(1192px, calc(100% - 48px)); margin: 0 auto; }
.v1-info-announcements__intro { min-height: 172px; padding: 25px 23px; border-radius: 23px; background: var(--v1-brand-soft); }
.v1-info-announcements__eyebrow { color: var(--v1-brand) !important; font: 600 13px/1.3 var(--v1-font-display); }
.v1-info-announcements__intro h2 { margin-top: 22px; font-size: 27px; }
.v1-info-announcements__intro > p:last-child { margin-top: 18px; color: var(--v1-muted); font-size: 14px; }
.v1-info-announcements__recovery, .v1-info-announcements__updated { margin-top: 18px; color: var(--v1-muted) !important; font-size: 13px; }
.v1-info-announcements__recovery button { min-height: 44px; margin-left: 8px; color: var(--v1-brand); font-weight: 700; }
.v1-info-announcements__cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px 32px; margin-top: 24px; }
.v1-info-announcements__card { position: relative; min-height: 179px; padding: 24px 21px 36px; border: 1px solid var(--v1-border); border-radius: 20px; background: color-mix(in srgb, var(--v1-brand-soft) 65%, var(--v1-surface)); }
.v1-info-announcements__card:nth-child(even) { background: var(--v1-tint-sky, var(--v1-bg)); }
.v1-info-announcements__card::before { content: ""; position: absolute; top: 13px; bottom: 13px; left: 8px; width: 4px; border-radius: 2px; background: var(--v1-brand); }
.v1-info-announcements__card h2 { max-width: calc(100% - 180px); font-size: 20px; line-height: 1.4; overflow-wrap: anywhere; }
.v1-info-announcements__card p { max-width: calc(100% - 44px); margin-top: 18px; color: var(--v1-muted); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.v1-info-announcements__chip { position: absolute; top: 21px; right: 23px; display: grid; min-width: 156px; min-height: 34px; place-items: center; padding: 4px 10px; border-radius: 15px; background: var(--v1-brand-soft); color: var(--v1-brand); font-size: 12px; }
.v1-info-announcements__link { display: inline-block; margin-top: 12px; color: var(--v1-brand); font-size: 13px; font-weight: 600; }
.v1-info-announcements__icon { position: absolute; right: 26px; bottom: 51px; }
.v1-info-announcements__icon img { width: 24px; height: 24px; max-width: none; }
.v1-info-announcements__rule { position: absolute; bottom: 18px; left: 21px; width: 265px; max-width: 60%; height: 4px; border-radius: 2px; background: var(--v1-brand-soft); }
.v1-info-announcements__rule::before { content: ""; display: block; width: 91px; max-width: 35%; height: 100%; border-radius: 2px; background: var(--v1-brand); }
.v1-info-announcements__empty { min-height: 152px; margin-top: 24px; background: var(--v1-bg); }
.v1-info-announcements__empty::before { background: var(--v1-border); }
.v1-info-announcements__useful { margin-top: 30px; }
:global(html[data-theme="high-contrast"]) .v1-info-announcements__intro { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-announcements__body { padding-top: 50px; }
 .v1-info-announcements__intro { min-height: 180px; }
 .v1-info-announcements__intro h2 { font-size: 21px; }
 .v1-info-announcements__cards { grid-template-columns: 1fr; gap: 13px; }
 .v1-info-announcements__card { min-height: 132px; }
 .v1-info-announcements__card h2 { max-width: calc(100% - 120px); }
 .v1-info-announcements__card p { margin-top: 18px; }
 .v1-info-announcements__chip { right: 10px; min-width: 103px; font-size: 11px; }
 .v1-info-announcements__icon { right: 36px; bottom: 24px; }
}
</style>
