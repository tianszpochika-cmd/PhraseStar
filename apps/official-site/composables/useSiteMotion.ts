import {
  createAdaptivePerformanceEngine,
  type AdaptivePerformanceEngine,
  type PerformanceLevel,
} from "@englishflow/performance";
export function useSiteMotion() {
  const reduced = useState("official:reduced", () => false);
  const level = useState<PerformanceLevel>("official:quality", () => "High");
  return {
    reduced,
    level,
    allowsDepth: computed(
      () => level.value !== "Performance" && !reduced.value,
    ),
  };
}
export function installSiteMotion() {
  const state = useSiteMotion();
  let engine: AdaptivePerformanceEngine | undefined,
    media: MediaQueryList | undefined,
    unsubscribe: (() => void) | undefined;
  let normalLevel: PerformanceLevel = "High";
  function sync() {
    state.reduced.value = media?.matches ?? false;
    document.documentElement.dataset.quality = state.level.value;
    document.documentElement.dataset.motion =
      !state.reduced.value && state.level.value !== "Performance"
        ? "on"
        : "off";
  }
  function changeReduced() {
    if (!engine) return;
    if (media?.matches) {
      normalLevel = engine.level;
      engine.setLevel("Performance", "auto");
      engine.setMotionDisabled(true, "auto");
    } else {
      engine.setLevel(normalLevel, "auto");
      engine.setMotionDisabled(false, "auto");
    }
    sync();
  }
  onMounted(() => {
    const storage = {
      getItem(key: string) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem(key: string, value: string) {
        try {
          localStorage.setItem(key, value);
        } catch {}
      },
    };
    media = matchMedia("(prefers-reduced-motion: reduce)");
    engine = createAdaptivePerformanceEngine({
      storage,
      storageKey: "yx.official.performance",
      // Derive the device/user baseline independently of the temporary
      // system override so it can be restored when that override is removed.
      reducedMotion: false,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: Reflect.get(navigator, "deviceMemory"),
    });
    engine.restore();
    normalLevel = engine.level;
    if (media.matches) engine.setLevel("Performance", "auto");
    // The public toggle was removed. Ignore its retired pause preference,
    // while continuing to respect system accessibility and quality settings.
    engine.setMotionDisabled(media.matches, "auto");
    state.level.value = engine.level;
    unsubscribe = engine.subscribe((next) => {
      if (!media?.matches) normalLevel = next.level;
      state.level.value = next.level;
      sync();
    });
    media.addEventListener("change", changeReduced);
    sync();
  });
  watch(state.level, (value) => {
    if (engine && engine.level !== value) {
      normalLevel = value;
      engine.setLevel(value);
      if (media?.matches) engine.setLevel("Performance", "auto");
    }
    if (import.meta.client) sync();
  });
  onBeforeUnmount(() => {
    media?.removeEventListener("change", changeReduced);
    unsubscribe?.();
    engine?.dispose();
  });
  return state;
}
