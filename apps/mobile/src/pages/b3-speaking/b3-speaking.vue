<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import MobileClosedPracticeNotice from '../../components/MobileClosedPracticeNotice.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted } from 'vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
function backToLearning(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }
function openRelated(url: string): void { getUniRuntime().navigateTo({ url }) }
const alternatives = [
  {
    id: 'vocab',
    target: '/pages/b2-vocabulary/b2-vocabulary',
    iconSrc: '/static/figma-closed-168-5501/2873e8dd-acf2-4903-a2e0-e1046ba5166d.svg',
    chevronSrc: '/static/figma-closed-168-5501/261b7c3f-f474-4abd-9e23-dff819c47d2b.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-5501/7f0256b5-f3cd-4635-b4d3-3d4b7045a127.svg',
    chevronSrc: '/static/figma-closed-168-5501/261b7c3f-f474-4abd-9e23-dff819c47d2b.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
onMounted(async () => { await session.restore(); if (!await ensureMobilePageAccess('/pages/b3-speaking/b3-speaking')) return; /* closed practice: no live load */ undefined })
</script>

<template>
  <view class="yx-page v2-closed-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
    <MobilePageHeader page="b3-speaking" compact :title="mobileT('closed.b3Speaking.navTitle')" back-icon-src="/static/figma-closed-168-5501/9e998881-5cf4-47d5-a4b3-8b77c7bb8347.svg" :show-settings="false" />
    <view class="v2-b3speak-body">
      <MobileClosedPracticeNotice
        variant="speaking"
        title-key="closed.b3Speaking.title"
        description-key="closed.b3Speaking.reason"
        aria-label-key="closed.b3Speaking.title"
        glow-src="/static/figma-closed-168-5501/abaf7a75-11e2-4a95-b329-8bc1452320fe.svg"
        icon-src="/static/figma-closed-168-5501/679cf7aa-0ce1-4ae7-8caf-70db9789cc07.svg"
        :alternatives="alternatives"
        @back="backToLearning"
        @select="openRelated"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-b3speak-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3speak-body>*{min-width:0;max-width:100%}
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
