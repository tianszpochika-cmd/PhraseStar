<template>
  <image class="figma-asset" :src="src" :style="frameStyle" mode="aspectFit" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ src: string; width: number; height: number }>()
const frameStyle = computed(() => ({ width: `${props.width}px`, height: `${props.height}px` }))
</script>

<style scoped>
.figma-asset { display: block; flex: 0 0 auto; }
</style>
