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
    iconSrc: '/static/figma-closed-168-3746/c783b91a-2153-42e2-acc6-7d5c181423e8.svg',
    chevronSrc: '/static/figma-closed-168-3746/1ad156ec-6c46-46a7-afde-69003eae8577.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-3746/afc85b52-a417-48b4-a07c-4f301dc9a259.svg',
    chevronSrc: '/static/figma-closed-168-3746/1ad156ec-6c46-46a7-afde-69003eae8577.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
onMounted(async () => { await session.restore(); if (!await ensureMobilePageAccess('/pages/b3-listening/b3-listening')) return; /* closed practice: no live load */ undefined })
</script>

<template>
  <view class="yx-page v2-closed-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
    <MobilePageHeader page="b3-listening" compact :title="mobileT('closed.b3Listening.navTitle')" back-icon-src="/static/figma-closed-168-3746/59736468-29fc-451d-b095-809594a1ff91.svg" :show-settings="false" />
    <view class="v2-b3listen-body">
      <MobileClosedPracticeNotice
        variant="listening"
        title-key="closed.b3Listening.title"
        description-key="closed.listening.reason"
        aria-label-key="closed.b3Listening.title"
        glow-src="/static/figma-closed-168-3746/055e2e46-2327-4a80-8732-dc6ba0135825.svg"
        icon-src="/static/figma-closed-168-3746/7473ba78-43b2-49ac-949f-bf252f5b027c.svg"
        :alternatives="alternatives"
        @back="backToLearning"
        @select="openRelated"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-b3listen-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
