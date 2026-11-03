import { createOfficialFoundation } from "~/utils/v2-foundation";
import { resolvePublicThemeMode } from "~/utils/public-projection";
export default defineNuxtPlugin((nuxtApp) => {
  const locale = useCookie<string>("yx.public.locale"),
    theme = useCookie<string>("yx.public.theme");
  const foundation = createOfficialFoundation(
    locale.value || "zh-CN",
    resolvePublicThemeMode(theme.value),
  );
  // Nuxt can replace app.vue with an error page without ending the app.
  // Shared controllers stay alive until the Vue application itself unmounts.
  if (import.meta.client) nuxtApp.vueApp.onUnmount(() => {
    foundation.officialI18nAdapter.dispose();
    foundation.officialThemeAdapter.dispose();
    foundation.officialThemeController.dispose();
  });
  return {
    provide: {
      foundation,
    },
  };
});
