<script setup lang="ts">
import { computed } from 'vue'
import FigmaAsset from '../../components/FigmaAsset.vue'
import { mobileT } from '../../platform/experience'

const props = defineProps<{
  variant: 'rail' | 'sidebar'
  theme: 'light' | 'dark' | 'high-contrast'
  active: 'home'
  disabled?: boolean
}>()
const emit = defineEmits<{ navigate: [path: string] }>()

const roots = {
  rail: '/static/figma-home-ipad-portrait-251-215',
  sidebar: '/static/figma-home-ipad-landscape-251-2',
  railDark: '/static/figma-home-ipad-dark-251-362',
  sidebarDark: '/static/figma-home-ipad-dark-251-362',
} as const

const lightIcons = {
  home: `${roots.rail}/975f38fe-51c5-41d9-ba10-b4f298a1ac44.svg`,
  practice: `${roots.rail}/62cc20ce-5d18-4bc2-b0d1-f7d761575a36.svg`,
  growth: `${roots.rail}/c87f2607-0db3-41c0-96a3-4ff20bd25bfb.svg`,
  learn: `${roots.rail}/83600205-9c99-41b1-9f52-92a1024e9d4d.svg`,
  profile: `${roots.rail}/de067aa9-9d32-4900-b032-1f033cbed8ac.svg`,
} as const
const darkIcons = {
  home: `${roots.railDark}/63cf9c11-a094-4f68-ace6-f12b899b7b9b.svg`,
  practice: `${roots.railDark}/27209ed9-89cc-4e18-81ec-c2188f7758e5.svg`,
  growth: `${roots.railDark}/9ad1dc0b-85de-4c9d-83df-0c8c5b6de644.svg`,
  learn: `${roots.railDark}/ca90ce8c-f74d-4017-bbbe-525da53cd3e2.svg`,
  profile: `${roots.railDark}/03d0cd8e-38e1-4493-8afd-fe977d3f1a90.svg`,
} as const

const assets = computed(() => {
  const dark = props.theme === 'dark'
  return {
    icons: dark ? darkIcons : lightIcons,
    logo: dark
      ? '/static/figma-home-ipad-dark-251-362/838f6938-47cc-473c-bc9c-de57bdf50c0e.png'
      : '/static/figma-home-ipad-landscape-251-2/6221cac1-324c-4b1e-bff0-f782906eb3eb.png',
    glow: props.variant === 'rail'
      ? (dark ? '/static/figma-home-ipad-dark-251-362/b11d6758-8e45-4027-a364-58934e08469c.svg' : '/static/figma-home-ipad-portrait-251-215/c31cbeed-30f4-4444-b4a8-7e6e627b39f7.svg')
      : (dark ? '/static/figma-home-ipad-dark-251-362/b11d6758-8e45-4027-a364-58934e08469c.svg' : '/static/figma-home-ipad-landscape-251-2/a64ca21f-eaa7-4b77-9f13-a28ff3d06f18.svg'),
  }
})

const items = computed(() => [
  { key: 'home' as const, path: '/pages/home/home', label: mobileT('pages.home.short'), icon: assets.value.icons.home },
  { key: 'practice' as const, path: '/pages/b2-practice/b2-practice', label: mobileT('pages.b2-practice.short'), icon: assets.value.icons.practice },
  { key: 'growth' as const, path: '/pages/world/world', label: mobileT('pages.world.short'), icon: assets.value.icons.growth },
  { key: 'learn' as const, path: '/pages/learn/learn', label: mobileT('pages.learn.short'), icon: assets.value.icons.learn },
  { key: 'profile' as const, path: '/pages/profile/profile', label: mobileT('pages.profile.short'), icon: assets.value.icons.profile },
])

function go(path: string): void {
  if (props.disabled) return
  emit('navigate', path)
}
</script>

<template>
  <view class="home-nav" role="navigation" :class="[`home-nav--${variant}`, `home-nav--${theme}`]" :aria-label="mobileT('pages.home.short')">
    <view class="home-nav__brand">
      <view class="home-nav__mark">
        <FigmaAsset class="home-nav__glow" :src="assets.glow" :width="variant === 'rail' ? 81 : 78" :height="variant === 'rail' ? 81 : 78" />
        <FigmaAsset :src="assets.logo" :width="variant === 'rail' ? 50 : 48" :height="variant === 'rail' ? 50 : 48" />
      </view>
      <view class="home-nav__wordmark">
        <text class="home-nav__name">{{ mobileT('brand') }}</text>
        <text class="home-nav__latin">{{ mobileT('brandEnglish') }}</text>
      </view>
    </view>
    <text v-if="variant === 'sidebar'" class="home-nav__tagline">{{ mobileT('pages.home.description') }}</text>

    <view class="home-nav__items">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        tabindex="0"
        class="home-nav__item"
        :class="{ 'is-active': active === item.key }"
        :aria-current="active === item.key ? 'page' : undefined"
        :disabled="disabled"
        @click="go(item.path)"
      >
        <view class="home-nav__icon"><FigmaAsset :src="item.icon" :width="24" :height="24" /></view>
        <text class="home-nav__label">{{ item.label }}</text>
        <view v-if="variant === 'sidebar' && active === item.key" class="home-nav__indicator" aria-hidden="true"></view>
      </button>
    </view>

    <button
      type="button"
      tabindex="0"
      class="home-nav__profile"
      :aria-label="mobileT('pages.profile.short')"
      :disabled="disabled"
      @click="go('/pages/profile/profile')"
    >
      <view class="home-nav__avatar" aria-hidden="true"><text>学</text></view>
      <view v-if="variant === 'sidebar'" class="home-nav__profile-copy">
        <text class="home-nav__profile-title">{{ mobileT('home.profileTitle') }}</text>
        <text class="home-nav__profile-sub">{{ mobileT('profileLinks') }}</text>
      </view>
    </button>
  </view>
</template>

<style scoped>
.home-nav {
  position: sticky;
  top: 0;
  z-index: 3;
  box-sizing: border-box;
  align-self: start;
  height: 100vh;
  overflow: hidden;
  color: var(--home-tablet-nav-item);
  background-color: var(--home-tablet-nav-bg);
  background-image: var(--home-tablet-nav-image);
  border-right: var(--home-tablet-nav-border);
}
.home-nav__brand { position: relative; display: flex; align-items: center; }
.home-nav__mark { position: relative; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.home-nav__glow { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.home-nav__wordmark { display: flex; flex-direction: column; min-width: 0; }
.home-nav__name { display: block; color: var(--home-tablet-nav-ink); font-weight: 800; line-height: 1.2; }
.home-nav__latin { display: block; color: var(--home-tablet-nav-latin); font-weight: 500; line-height: 1.2; }
.home-nav__tagline { display: block; color: var(--home-tablet-nav-tagline); font-size: 12px; line-height: 17px; }

.home-nav--rail { width: 86px; padding: 30px 0 56px; text-align: center; }
.home-nav--rail .home-nav__brand { flex-direction: column; gap: 0; }
.home-nav--rail .home-nav__mark { width: 50px; height: 50px; margin: 0 auto; border-radius: 16px; }
.home-nav--rail .home-nav__wordmark { margin-top: 16px; width: 86px; }
.home-nav--rail .home-nav__name { font-size: 12px; line-height: 15px; }
.home-nav--rail .home-nav__latin { font-size: 9px; line-height: 12px; }
.home-nav--rail .home-nav__items { display: flex; flex-direction: column; gap: 22px; margin-top: 23px; }
.home-nav--rail .home-nav__item { width: 68px; height: 78px; margin: 0 auto; padding: 9px 0 0; border: 0; border-radius: 16px; background: transparent; color: var(--home-tablet-nav-item); }
.home-nav--rail .home-nav__item.is-active { background: var(--home-tablet-nav-item-active-bg); color: var(--home-tablet-nav-item-active); border: var(--home-tablet-nav-active-border); }
.home-nav--rail .home-nav__icon { width: 34px; height: 34px; margin: 0 auto; border: var(--home-tablet-nav-icon-border); border-radius: 11px; background: var(--home-tablet-nav-icon-bg); }
.home-nav--rail .home-nav__item.is-active .home-nav__icon { background: var(--home-tablet-nav-icon-active-bg); }
.home-nav--rail .home-nav__label { display: block; margin-top: 2px; font-size: 12px; line-height: 17px; text-align: center; }
.home-nav--rail .home-nav__item.is-active .home-nav__label { font-weight: 700; }
.home-nav__icon { display: flex; align-items: center; justify-content: center; }

.home-nav--sidebar { width: 244px; padding: 28px 16px 0; }
.home-nav--sidebar .home-nav__brand { gap: 13px; }
.home-nav--sidebar .home-nav__mark { width: 48px; height: 48px; border-radius: 16px; }
.home-nav--sidebar .home-nav__wordmark { margin-top: -6px; }
.home-nav--sidebar .home-nav__name { font-size: 23px; line-height: 33px; }
.home-nav--sidebar .home-nav__latin { color: var(--home-tablet-nav-latin); font-size: 11px; line-height: 15px; }
.home-nav--sidebar .home-nav__tagline { margin-top: 15px; width: 206px; }
.home-nav--sidebar .home-nav__items { display: flex; flex-direction: column; gap: 12px; margin-top: 53px; }
.home-nav--sidebar .home-nav__item { position: relative; display: flex; align-items: center; gap: 13px; box-sizing: border-box; width: 212px; height: 54px; padding: 0 12px; border: 0; border-radius: 15px; background: transparent; color: var(--home-tablet-nav-item); text-align: left; }
.home-nav--sidebar .home-nav__item.is-active { background: var(--home-tablet-nav-item-active-bg); color: var(--home-tablet-nav-item-active); border: var(--home-tablet-nav-active-border); }
.home-nav--sidebar .home-nav__icon { width: 36px; height: 36px; border: var(--home-tablet-nav-icon-border); border-radius: 11px; background: var(--home-tablet-nav-icon-bg); }
.home-nav--sidebar .home-nav__item.is-active .home-nav__icon { background: var(--home-tablet-nav-icon-active-bg); }
.home-nav--sidebar .home-nav__label { font-size: 16px; font-weight: 500; line-height: 23px; }
.home-nav--sidebar .home-nav__item.is-active .home-nav__label { font-weight: 700; }
.home-nav__indicator { position: absolute; right: 4px; top: 15px; width: 3px; height: 24px; border-radius: 2px; background: var(--home-tablet-nav-indicator); }

.home-nav--rail .home-nav__profile { position: absolute; left: 18px; bottom: 56px; width: 50px; height: 50px; padding: 0; border: var(--home-tablet-nav-profile-border); border-radius: 25px; background: var(--home-tablet-nav-profile-bg); color: var(--home-tablet-nav-ink); }
.home-nav--sidebar .home-nav__profile { position: absolute; left: 16px; bottom: 23px; display: flex; align-items: center; gap: 11px; box-sizing: border-box; width: 212px; height: 87px; padding: 16px 13px; border: var(--home-tablet-nav-profile-border); border-radius: 18px; background: var(--home-tablet-nav-profile-bg); color: var(--home-tablet-nav-ink); text-align: left; }
.home-nav__avatar { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 50px; height: 50px; border-radius: 25px; background-color: var(--home-tablet-nav-avatar-bg); background-image: var(--home-tablet-nav-avatar-image); color: var(--home-tablet-nav-avatar-ink); font-size: 21px; font-weight: 700; line-height: 1; }
.home-nav--sidebar .home-nav__avatar { width: 44px; height: 44px; border-radius: 22px; font-size: 20px; }
.home-nav__profile-copy { display: flex; flex-direction: column; min-width: 0; }
.home-nav__profile-title { display: block; color: var(--home-tablet-nav-ink); font-size: 15px; font-weight: 700; line-height: 22px; }
.home-nav__profile-sub { display: block; color: var(--home-tablet-nav-profile-sub); font-size: 12px; line-height: 17px; }

.home-nav__item[disabled], .home-nav__profile[disabled] { opacity: .6; }
.home-nav__item:focus-visible, .home-nav__profile:focus-visible { outline: 2px solid var(--home-tablet-nav-focus); outline-offset: 2px; }

</style>
