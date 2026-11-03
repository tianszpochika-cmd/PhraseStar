// Test-only Node 20 resolver for this site's shared i18n source imports.
// Production bundling keeps using Nuxt's normal TypeScript resolution.
export { load } from "../../../scripts/dev/typescript-loader.mjs";

const i18nSource = new URL("../../../packages/i18n/src/", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (!context.parentURL?.startsWith(i18nSource) || !specifier.startsWith(".")) {
    return nextResolve(specifier, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(error.code)) throw error;
    for (const suffix of [".ts", "/index.ts"]) {
      try {
        return await nextResolve(`${specifier}${suffix}`, context);
      } catch (candidateError) {
        if (candidateError.code !== "ERR_MODULE_NOT_FOUND") throw candidateError;
      }
    }
    throw error;
  }
}
