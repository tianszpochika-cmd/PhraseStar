<script setup lang="ts">
import CatalogView from "~/components/v1/experience/CatalogView.vue";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const { loadState, getFacet, load } = usePublicProjection("pricing");
const facet = computed(() => {
  const value = getFacet("pricing");
  // A contradictory stale ready/empty response cannot establish the current catalog.
  return value.stale && ["ready", "empty"].includes(value.state)
    ? { ...value, state: "recovery" as const }
    : value;
});
const plans = computed(() => [...new Map(
  [...loadState.value.projection.skus, ...loadState.value.projection.pricingPlans]
    .filter((plan) => plan.availability === "available")
    .map((plan) => [plan.skuId || plan.id, plan]),
).values()]);
const catalogEmpty = computed(() => facet.value.state === "empty" || (facet.value.state === "ready" && !plans.value.length));
useOfficialSeo({ title: t("official.v1.experience.pricing.seoTitle"), description: t("official.v1.experience.pricing.seoDescription"), path: "/pricing" });
</script>
<template>
  <CatalogView kind="pricing" :state="facet.state" :empty="catalogEmpty" :updated-at="facet.updatedAt" :plans="plans" :channels="[]" @retry="load" />
</template>
