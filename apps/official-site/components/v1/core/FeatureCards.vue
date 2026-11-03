<script setup lang="ts">
defineProps<{ cards: readonly { title: string; description: string }[]; icon: string; action: string; target: string; variant: "detail" | "method" }>();
</script>
<template>
  <div class="v1-core-features" :class="`v1-core-features--${variant}`">
    <article v-for="(card, index) in cards" :key="card.title" :data-tone="index">
      <div class="v1-core-features__heading"><h2>{{ card.title }}</h2><span aria-hidden="true"><img :src="icon" width="24" height="24" alt="" /></span></div>
      <p>{{ card.description }}</p>
      <NuxtLink :to="target">{{ action }}<span aria-hidden="true">→</span></NuxtLink>
    </article>
  </div>
</template>
<style scoped>
.v1-core-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.v1-core-features article { position: relative; min-width: 0; min-height: 177px; padding: 19px; border: 1px solid var(--v1-card-border); border-radius: 20px; background: var(--v1-card-lilac); }
.v1-core-features--detail article { padding-bottom: 16px; }
.v1-core-features--method article { min-height: 185px; padding-bottom: 17px; }
.v1-core-features article[data-tone="1"] { background: var(--v1-card-mint); }
.v1-core-features article[data-tone="2"] { background: var(--v1-card-sand); }
.v1-core-features article::before { content: ""; position: absolute; left: -1px; top: 18px; width: 3px; height: 22px; border-radius: 2px; background: var(--v1-card-lilac-accent); }
.v1-core-features article[data-tone="1"]::before { background: var(--v1-card-mint-accent); }
.v1-core-features article[data-tone="2"]::before { background: var(--v1-card-sand-accent); }
.v1-core-features__heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.v1-core-features h2 { font-size: 21px; line-height: 29px; }
.v1-core-features__heading > span { display: grid; place-items: center; flex: 0 0 42px; width: 42px; height: 42px; margin: -7px -7px -5px 0; border-radius: 13px; background: var(--v1-surface); }
.v1-core-features p { min-height: 40px; margin-top: 13px; padding-bottom: 9px; border-bottom: 1px solid var(--v1-card-divider); color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-core-features--detail article:is([data-tone="0"], [data-tone="2"]) p, .v1-core-features--method article[data-tone="2"] p { color: var(--v1-copy-secondary); }
.v1-core-features--method p { min-height: 49px; }
.v1-core-features a { position: relative; isolation: isolate; display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-top: 13px; padding: 0 15px 6px 16px; border-radius: 12px; color: var(--v1-brand); font-size: 13px; font-weight: 500; }
.v1-core-features a::before { content: ""; position: absolute; z-index: -1; inset: 0 0 6px; border-radius: inherit; background: var(--v1-surface); }
.v1-core-features--method a { margin-top: 11px; }
.v1-core-features a span { font: 600 19px var(--v1-font-display); }
.v1-core-features a:focus-visible { outline-color: var(--v1-focus); }
@media (max-width: 700px) {
  .v1-core-features { grid-template-columns: 1fr; gap: 12px; }
  .v1-core-features article { min-height: 130px; padding-bottom: 19px; border-radius: 16px; }
  .v1-core-features__heading > span, .v1-core-features a { display: none; }
  .v1-core-features p { min-height: 0; margin-top: 11px; padding: 0; border: 0; }
}
</style>
