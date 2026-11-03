<script setup lang="ts">
import { isInformationPage } from "~/utils/site-layout";

const { t } = useSiteText();
const route = useRoute();
const isHome = computed(() => route.path === "/");
const homeGroups = [
  {
    title: "official.v1.common.footer.explore",
    links: [
      ["/method", "official.v1.common.nav.method"],
      ["/courses", "official.v1.common.nav.courses"],
      ["/pricing", "official.v1.common.nav.membership"],
    ],
  },
  {
    title: "official.v1.common.footer.support",
    links: [
      ["/help", "official.v1.common.nav.help"],
      ["/status", "official.v1.common.footer.status"],
      ["/help#contact", "official.v1.common.footer.contact"],
    ],
  },
  {
    title: "official.v1.common.footer.legal",
    links: [
      ["/terms", "official.v1.common.footer.terms"],
      ["/privacy", "official.v1.common.footer.privacy"],
      ["/compliance", "official.v1.common.footer.compliance"],
    ],
  },
] as const;
const innerGroups = [
  {
    title: "official.v1.common.footer.exploreLearning",
    links: [["/courses", "official.v1.common.nav.courses"], ["/world", "official.v1.common.nav.world"], ["/method", "official.v1.common.nav.method"]],
  },
  {
    title: "official.v1.common.footer.about",
    links: [["/help", "official.v1.common.nav.help"], ["/about", "official.v1.common.footer.aboutLink"]],
  },
  {
    title: "official.v1.common.footer.agreements",
    links: [["/privacy", "official.v1.common.footer.privacy"], ["/terms", "official.v1.common.footer.terms"]],
  },
] as const;
const homeMobileLinks = [
  ["/courses", "official.v1.common.nav.courses"],
  ["/method", "official.v1.common.nav.method"],
  ["/pricing", "official.v1.common.nav.membership"],
  ["/help", "official.v1.common.nav.help"],
  ["/terms", "official.v1.common.footer.terms"],
  ["/privacy", "official.v1.common.footer.privacy"],
] as const;
const innerMobileLinks = [
  ["/courses", "official.v1.common.nav.courses"],
  ["/method", "official.v1.common.nav.method"],
  ["/help", "official.v1.common.nav.help"],
  ["/privacy", "official.v1.common.footer.privacy"],
  ["/terms", "official.v1.common.footer.terms"],
  ["/compliance", "official.v1.common.footer.complianceLink"],
] as const;
const informationMobileLinks = [
  ["/courses", "official.v1.common.nav.courses"],
  ["/world", "official.v1.common.nav.world"],
  ["/help", "official.v1.common.nav.help"],
  ["/privacy", "official.v1.common.footer.privacy"],
  ["/terms", "official.v1.common.footer.terms"],
  ["/compliance", "official.v1.common.footer.complianceLink"],
] as const;
const isInformation = computed(() => isInformationPage(route.path));
const groups = computed(() => isHome.value ? homeGroups : innerGroups);
const mobileLinks = computed(() => isHome.value ? homeMobileLinks : isInformation.value ? informationMobileLinks : innerMobileLinks);
</script>

<template>
  <footer class="v1-site-footer" :class="{ 'v1-site-footer--interior': !isHome, 'v1-site-footer--information': isInformation }">
    <div class="v1-site-footer__inner">
      <div class="v1-site-footer__main">
        <div class="v1-site-footer__brand">
          <SiteBrand variant="footer" />
          <p lang="en">{{ t("official.v1.common.slogan") }}</p>
        </div>
        <nav
          v-for="group in groups"
          :key="group.title"
          class="v1-site-footer__column"
          :aria-label="t(group.title)"
        >
          <h2>{{ t(group.title) }}</h2>
          <NuxtLink v-for="[path, label] in group.links" :key="path" :to="path" :aria-current="route.path === path ? 'page' : undefined">
            {{ t(label) }}
          </NuxtLink>
        </nav>
      </div>
      <nav class="v1-site-footer__mobile-links" :aria-label="t('official.c5e0350877')">
        <NuxtLink v-for="[path, label] in mobileLinks" :key="path" :to="path" :aria-current="route.path === path ? 'page' : undefined">
          {{ t(label) }}
        </NuxtLink>
      </nav>
      <div v-if="isHome" class="v1-site-footer__bottom">
        <span class="v1-site-footer__copyright--desktop">{{ t("official.v1.common.footer.copyrightDesktop") }}</span>
        <span class="v1-site-footer__copyright--mobile">{{ t("official.v1.common.footer.copyrightMobile") }}</span>
        <NuxtLink to="/compliance">{{ t("official.v1.common.footer.publicInfo") }}</NuxtLink>
      </div>
    </div>
  </footer>
</template>
