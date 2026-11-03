<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; intro: string; entries: string[]; steps: string[] }>();
const { t } = useSiteText();
</script>
<template>
  <section class="v1-info-useful">
    <p class="v1-info-useful__eyebrow">{{ eyebrow }}</p>
    <h2>{{ title }}</h2>
    <p class="v1-info-useful__intro">{{ intro }}</p>
    <div class="v1-info-useful__grid">
      <div class="v1-info-useful__card">
        <h3>{{ t("official.v1.info.help.entries") }}</h3>
        <div v-for="(entry, index) in entries" :key="entry" class="v1-info-useful__row"><span>0{{ index + 1 }}</span><p>{{ entry }}</p></div>
      </div>
      <div class="v1-info-useful__card v1-info-useful__steps">
        <h3>{{ t("official.v1.info.help.steps") }}</h3>
        <div v-for="(step, index) in steps" :key="step" class="v1-info-useful__row"><span>0{{ index + 1 }}</span><p>{{ step }}</p></div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.v1-info-useful { padding: 26px 22px 29px; border-radius: 25px; color: var(--v1-text); background: var(--v1-info-useful-bg, var(--v1-bg)); }
.v1-info-useful p { color: inherit; }
.v1-info-useful__eyebrow { color: var(--v1-brand) !important; font: 600 12px/1.3 var(--v1-font-display); }
.v1-info-useful h2 { margin-top: 19px; font-size: 27px; line-height: 38px; }
.v1-info-useful__intro { margin-top: 7px; color: var(--v1-muted) !important; font-size: 13px; line-height: 20px; }
.v1-info-useful__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 17px; margin-top: 35px; }
.v1-info-useful__card { padding: 16px 18px 20px; border-radius: 17px; background: var(--v1-surface); }
.v1-info-useful__card h3 { margin-bottom: 16px; font-size: 17px; }
.v1-info-useful__row { display: flex; align-items: center; gap: 13px; min-height: 43px; margin-top: 8px; padding: 5px 7px; border-radius: 12px; background: var(--v1-info-topic-lilac, var(--v1-brand-soft)); font-size: 14px; font-weight: 500; }
.v1-info-useful__row:nth-of-type(2) { background: var(--v1-info-topic-sky, var(--v1-tint-sky)); }
.v1-info-useful__row:nth-of-type(3) { background: var(--v1-info-topic-mint, var(--v1-tint-mint)); }
.v1-info-useful__row > span { display: grid; place-items: center; flex: 0 0 46px; min-height: 29px; border-radius: 11px; background: var(--v1-surface); color: var(--v1-brand); font: 600 12px/1 var(--v1-font-display); }
.v1-info-useful__steps .v1-info-useful__row { background: var(--v1-info-useful-bg, var(--v1-bg)); font-weight: 700; }
.v1-info-useful__steps .v1-info-useful__row:first-of-type { background: var(--v1-info-topic-lilac, var(--v1-brand-soft)); }
.v1-info-useful__steps .v1-info-useful__row > span { background: transparent; }
html[data-theme="high-contrast"] .v1-info-useful, html[data-theme="high-contrast"] .v1-info-useful__card { border: 1px solid var(--v1-border); }
html[data-theme="high-contrast"] .v1-info-useful__row > span { border: 1px solid var(--v1-border); }
@media (max-width: 800px) {
 .v1-info-useful { padding: 19px 15px 24px; }
 .v1-info-useful h2 { margin-top: 19px; font-size: 20px; line-height: 29px; }
 .v1-info-useful__intro { min-height: 40px; margin-top: 22px; }
 .v1-info-useful__grid { grid-template-columns: 1fr; gap: 20px; margin-top: 19px; }
 .v1-info-useful__card { padding: 12px; }
 .v1-info-useful__card:not(.v1-info-useful__steps) { min-height: 140px; padding: 13px 12px 21px; }
 .v1-info-useful__card h3 { display: none; }
 .v1-info-useful__row { min-height: 30px; margin-top: 5px; padding: 0; background: transparent !important; font-size: 12px; }
 .v1-info-useful__row:first-of-type { margin-top: 0; }
 .v1-info-useful__card:not(.v1-info-useful__steps) .v1-info-useful__row + .v1-info-useful__row { margin-top: 8px; }
 .v1-info-useful__row > span { flex-basis: 40px; min-height: 30px; background: var(--v1-info-topic-lilac, var(--v1-brand-soft)); }
 .v1-info-useful__card:not(.v1-info-useful__steps) .v1-info-useful__row:nth-of-type(2) > span { background: var(--v1-info-topic-sky, var(--v1-tint-sky)); }
 .v1-info-useful__card:not(.v1-info-useful__steps) .v1-info-useful__row:nth-of-type(3) > span { background: var(--v1-info-topic-mint, var(--v1-tint-mint)); }
 .v1-info-useful__steps .v1-info-useful__row { min-height: 32px; font-size: 13px; font-weight: 500; }
 .v1-info-useful__steps .v1-info-useful__row > span { flex-basis: 27px; }
 .v1-info-useful__steps .v1-info-useful__row:first-of-type { color: var(--v1-brand); }
 .v1-info-useful__steps .v1-info-useful__row:not(:first-of-type) > span { color: var(--v1-text); }
}
</style>
