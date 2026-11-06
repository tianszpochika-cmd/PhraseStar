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
    iconSrc: '/static/figma-closed-168-6945/160841d4-c5ed-477c-889d-09d66d800524.svg',
    chevronSrc: '/static/figma-closed-168-6945/3c5187e8-0de1-47b7-a99f-096226453a9f.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-6945/a2fb823f-a42c-4ae9-9e76-da240a0d712a.svg',
    chevronSrc: '/static/figma-closed-168-6945/3c5187e8-0de1-47b7-a99f-096226453a9f.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
onMounted(async () => { await session.restore(); if (!await ensureMobilePageAccess('/pages/b3-writing/b3-writing')) return; /* closed practice: no live load */ undefined })
</script>

<template>
  <view class="yx-page v2-closed-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b3-writing" compact :title="mobileT('closed.writing.navTitle')" back-icon-src="/static/figma-closed-168-6945/c2887965-483d-4879-8090-ebece5c7c6a6.svg" :show-settings="false" />
    <MobileClosedPracticeNotice
      variant="writing"
      title-key="closed.writing.title"
      description-key="closed.writing.reason"
      aria-label-key="closed.writing.title"
      glow-src="/static/figma-closed-168-6945/b58014db-d97f-4102-b67a-add6a602160c.svg"
      icon-src="/static/figma-closed-168-6945/3cfa29d3-5518-43db-9c68-8ddefe5c9e9a.svg"
      :alternatives="alternatives"
      @back="backToLearning"
      @select="openRelated"
    />
  </view>
</template>

<style scoped lang="scss">
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
