<script setup lang="ts">
import type { ThemeMode } from "@englishflow/design-tokens";
import { isInformationPage } from "~/utils/site-layout";

const { t } = useSiteText();
const { officialI18nAdapter, officialThemeController } = useNuxtApp().$foundation;
const { authLink } = useOfficialSiteLinks();
const route = useRoute();
const menu = ref(false);
const preferences = useState("official:preferences", () => false);
const preferencePanel = ref<"home" | "theme" | "language">("home");
const theme = ref(officialThemeController.theme);
const homeLinks = [
  ["/", "official.v1.common.nav.home"],
  ["/method", "official.v1.common.nav.method"],
  ["/courses", "official.v1.common.nav.courses"],
  ["/pricing", "official.v1.common.nav.membership"],
  ["/help", "official.v1.common.nav.help"],
] as const;
const innerLinks = [
  ["/courses", "official.v1.common.nav.courses"],
  ["/world", "official.v1.common.nav.world"],
  ["/method", "official.v1.common.nav.method"],
  ["/help", "official.v1.common.nav.help"],
] as const;
const mobileLinks = [
  ["/", "official.v1.common.nav.home"],
  ["/courses", "official.v1.common.nav.courses"],
  ["/world", "official.v1.common.nav.world"],
  ["/method", "official.v1.common.nav.method"],
  ["/help", "official.v1.common.nav.help"],
  ["/pricing", "official.v1.common.nav.membership"],
  ["/download", "official.v1.common.nav.download"],
] as const;
const themeOptions: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "official.v1.common.settings.system" },
  { value: "light", label: "official.v1.common.settings.light" },
  { value: "dark", label: "official.v1.common.settings.dark" },
  { value: "high-contrast", label: "official.v1.common.settings.contrast" },
];
const isHome = computed(() => route.path === "/");
const isInformation = computed(() => isInformationPage(route.path));
const links = computed(() => isHome.value ? homeLinks : innerLinks);
const preferenceTitle = computed(() => t(`official.v1.common.settings.${
  preferencePanel.value === "home" ? "title" : preferencePanel.value
}`));
const selectedThemeLabel = computed(() =>
  t(themeOptions.find((option) => option.value === theme.value)?.label ?? "official.v1.common.settings.system"));
let unsubscribeTheme: (() => void) | undefined;
onMounted(() => {
  unsubscribeTheme = officialThemeController.subscribe((state) => {
    theme.value = state.theme;
  });
});
onBeforeUnmount(() => unsubscribeTheme?.());
watch(() => route.fullPath, () => { menu.value = false; });
watch(preferences, (open) => { if (open) preferencePanel.value = "home"; });
function isCurrent(path: string) {
  return route.path === path || (path !== "/" && route.path.startsWith(`${path}/`));
}
function returnFromPreferences() {
  if (preferencePanel.value === "home") preferences.value = false;
  else preferencePanel.value = "home";
}
</script>

<template>
  <header class="v1-site-header" :class="{ 'v1-site-header--interior': !isHome, 'v1-site-header--information': isInformation }">
    <div class="v1-site-header__inner">
      <SiteBrand />
      <nav class="v1-site-header__nav" :aria-label="t('official.v1.common.nav.primary')">
        <NuxtLink
          v-for="[path, label] in links"
          :key="path"
          :to="path"
          :aria-current="isCurrent(path) ? 'page' : undefined"
        >{{ t(label) }}</NuxtLink>
      </nav>
      <div class="v1-site-header__actions">
        <button v-if="isHome" type="button" class="v1-site-header__text-action" @click="preferences = true">
          {{ t("official.v1.common.nav.settings") }}
        </button>
        <NuxtLink v-if="isHome" class="v1-site-header__text-action" :to="authLink()" external>
          {{ t("official.v1.common.nav.login") }}
        </NuxtLink>
        <SiteStartButton
          class="v1-site-header__start"
          :label="t('official.v1.common.nav.start')"
          icon-src="/figma-v1/assets/header-desktop-168-75/imgFrame.svg"
          :show-icon="isHome"
        />
      </div>
      <button
        type="button"
        class="v1-site-header__menu-button"
        :aria-label="t('official.v1.common.nav.menu')"
        aria-haspopup="dialog"
        :aria-expanded="menu"
        @click="menu = true"
      >
        <span v-if="isHome">{{ t("official.v1.common.nav.menu") }}</span>
        <span class="v1-site-header__menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </div>
  </header>

  <SiteModal :open="menu" :title="t('official.v1.common.brand')" menu close-text @close="menu = false">
    <nav class="v1-mobile-menu" :aria-label="t('official.v1.common.nav.primary')">
      <NuxtLink v-for="[path, label] in mobileLinks" :key="path" :to="path" :aria-current="isCurrent(path) ? 'page' : undefined">
        {{ t(label) }}
      </NuxtLink>
      <SiteStartButton :label="t('official.v1.common.nav.start')" :show-icon="false" />
      <button type="button" @click="menu = false; preferences = true">
        {{ t("official.v1.common.settings.title") }}
      </button>
      <p>{{ t("official.v1.common.nav.adult") }}</p>
    </nav>
  </SiteModal>

  <SiteModal :open="preferences" :title="preferenceTitle" bare @close="preferences = false">
    <div class="v1-preferences">
      <div class="v1-preferences__header">
        <button type="button" @click="returnFromPreferences">{{ t("official.v1.common.settings.back") }}</button>
        <h2>{{ preferenceTitle }}</h2>
      </div>
      <template v-if="preferencePanel === 'home'">
        <p>{{ t("official.v1.common.settings.intro") }}</p>
        <button type="button" class="v1-preferences__row" @click="preferencePanel = 'language'">
          <span>{{ t("official.v1.common.settings.language") }}</span>
          <span>{{ t("official.v1.common.settings.chinese") }} ›</span>
        </button>
        <button type="button" class="v1-preferences__row" @click="preferencePanel = 'theme'">
          <span>{{ t("official.v1.common.settings.theme") }}</span><span>{{ selectedThemeLabel }} ›</span>
        </button>
        <small>{{ t("official.v1.common.settings.homeNote") }}</small>
      </template>
      <template v-else-if="preferencePanel === 'theme'">
        <p>{{ t("official.v1.common.settings.themeNote") }}</p>
        <fieldset class="v1-preferences__choices" :aria-label="t('official.v1.common.settings.theme')">
          <label v-for="option in themeOptions" :key="option.value" class="v1-preferences__row" :data-selected="theme === option.value">
            <input type="radio" name="v1-theme" :value="option.value" :checked="theme === option.value" @change="officialThemeController.setTheme(option.value)" />
            <span>{{ t(option.label) }}</span>
            <span>{{ theme === option.value ? t("official.v1.common.settings.selected") : "›" }}</span>
          </label>
        </fieldset>
        <small>{{ t("official.v1.common.settings.themeSaved") }}</small>
      </template>
      <template v-else>
        <p>{{ t("official.v1.common.settings.languageNote") }}</p>
        <button type="button" class="v1-preferences__row" data-selected="true" @click="officialI18nAdapter.setLocale('zh-CN')">
          <span>{{ t("official.v1.common.settings.chinese") }}</span><span>{{ t("official.v1.common.settings.selected") }}</span>
        </button>
        <button type="button" class="v1-preferences__row" disabled>
          <span lang="en">{{ t("official.v1.common.settings.english") }}</span><span>{{ t("official.v1.common.settings.preview") }}</span>
        </button>
        <small>{{ t("official.v1.common.settings.englishNote") }}</small>
      </template>
    </div>
  </SiteModal>
</template>
