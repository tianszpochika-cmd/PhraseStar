<script setup lang="ts">
import CatalogView from "~/components/v1/experience/CatalogView.vue";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const { loadState, getFacet, load } = usePublicProjection("download");
const facet = computed(() => {
  const value = getFacet("download");
  // A contradictory stale ready/empty response cannot establish the current catalog.
  return value.stale && ["ready", "empty"].includes(value.state)
    ? { ...value, state: "recovery" as const }
    : value;
});
const channels = computed(() => loadState.value.projection.downloadChannels.filter((channel) => channel.availability === "available"));
const catalogEmpty = computed(() => facet.value.state === "empty" || (facet.value.state === "ready" && !channels.value.length));
useOfficialSeo({ title: t("official.v1.experience.download.seoTitle"), description: t("official.v1.experience.download.seoDescription"), path: "/download" });
</script>
<template>
  <CatalogView kind="download" :state="facet.state" :empty="catalogEmpty" :updated-at="facet.updatedAt" :plans="[]" :channels="channels" @retry="load" />
</template>
