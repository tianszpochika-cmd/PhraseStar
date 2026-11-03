import {
  onMounted,
  onServerPrefetch,
  useRequestFetch,
  useState,
} from "#imports";
import {
  EMPTY_PUBLIC_PROJECTION,
  resolvePublicUiLocale,
  type PublicFacetStatus,
  type PublicProjectionFacet,
  type PublicProjectionResponse,
  type PublicUiLocale,
} from "~/utils/public-projection";

const facetNames: readonly PublicProjectionFacet[] = [
  "courses", "pricing", "download", "announcements", "compliance",
];
const publicStates = new Set(["loading", "ready", "empty", "error", "permission", "recovery", "maintenance"]);

function isFacetStatus(value: unknown): value is PublicFacetStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  return typeof status.state === "string" && publicStates.has(status.state)
    && (status.updatedAt === null || typeof status.updatedAt === "string")
    && (status.errorCode === null || typeof status.errorCode === "string")
    && typeof status.stale === "boolean"
    && !(status.stale && (status.state === "ready" || status.state === "empty"));
}

function hasCompleteFacets(response: PublicProjectionResponse): boolean {
  const facets: unknown = response.facets;
  if (!facets || typeof facets !== "object" || Array.isArray(facets)) return false;
  const records = facets as Record<string, unknown>;
  return facetNames.every((name) => isFacetStatus(records[name]));
}

function hasUsableProjection(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const projection = value as Record<string, unknown>;
  const collections = ["courses", "pricingPlans", "skus", "campaigns", "downloadChannels", "announcements", "complianceNotices"];
  if (!collections.every((name) => Array.isArray(projection[name]))) return false;
  const records = collections.every((name) => (projection[name] as unknown[])
    .every((item) => item !== null && typeof item === "object" && !Array.isArray(item)));
  if (!records) return false;
  const prices = [
    ...(projection.pricingPlans as Record<string, unknown>[]),
    ...(projection.skus as Record<string, unknown>[]),
  ];
  if (!prices.every((item) => typeof item.id === "string" && Array.isArray(item.entitlements)
    && item.entitlements.every((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const entitlement = entry as Record<string, unknown>;
      return typeof entitlement.id === "string" && typeof entitlement.name === "string"
        && typeof entitlement.description === "string";
    }))) return false;
  return (projection.announcements as Record<string, unknown>[]).every((item) =>
    item.publishedAt === null || typeof item.publishedAt === "string");
}

function emptyResponse(
  state: "loading" | "error" | "permission" | "maintenance",
  errorCode: string | null,
): PublicProjectionResponse {
  const facet = () => ({ state, updatedAt: null, errorCode, stale: false });
  return {
    projection: EMPTY_PUBLIC_PROJECTION,
    state,
    stale: false,
    source: "empty-fallback",
    errorCode,
    facets: {
      courses: facet(),
      pricing: facet(),
      download: facet(),
      announcements: facet(),
      compliance: facet(),
    },
    commerceState: state,
    commerceErrorCode: errorCode,
  };
}

export function usePublicProjection(
  key = "official-site",
  requestedLocale?: PublicUiLocale,
) {
  const request = useRequestFetch();
  const { locale: uiLocale } = useSiteText();
  const locale = computed(() => requestedLocale ?? resolvePublicUiLocale(uiLocale.value));
  // A fresh, SSR-stable key prevents a revisited route from briefly reusing
  // facts fetched before the visitor left or changed their language.
  const instanceId = useId();
  const stateKey = `public-projection:${key}:${requestedLocale ?? "ui"}:${instanceId}`;
  const result = useState<PublicProjectionResponse>(
    stateKey,
    () => emptyResponse("loading", null),
  );
  let requestSequence = 0;
  let pending: { locale: PublicUiLocale; sequence: number; promise: Promise<void> } | null = null;

  async function load(): Promise<void> {
    const requested = locale.value;
    if (pending?.locale === requested) return pending.promise;
    const sequence = ++requestSequence;
    const promise = (async () => {
      try {
        let commerceDegraded = false;
        const response = await request<PublicProjectionResponse>(
          "/api/public-projection",
          {
            query: { locale: requested },
            onResponse({ response }) {
              commerceDegraded = response.headers.get("x-public-projection-commerce") === "degraded";
            },
          },
        );
        if (!response || !hasUsableProjection(response.projection) || !publicStates.has(response.state)
          || typeof response.stale !== "boolean"
          || (response.stale && (response.state === "ready" || response.state === "empty"))
          || !hasCompleteFacets(response))
          throw new Error("PUBLIC_PROJECTION_UNAVAILABLE");
        if (sequence !== requestSequence) return;
        // The existing BFF can keep content usable while its commerce read fails.
        // Only the pricing scope must treat that cleared catalog as unavailable.
        if (response.state === "permission" || response.state === "error" || response.state === "maintenance") {
          // Global unreadable states win even if an inconsistent response
          // claims a facet is ready or carries previously published facts.
          result.value = { ...emptyResponse(response.state, response.errorCode), source: response.source };
        } else {
          result.value = key === "pricing" && commerceDegraded
            ? emptyResponse("error", "PUBLIC_COMMERCE_PROJECTION_UNAVAILABLE")
            : response;
        }
      } catch {
        if (sequence === requestSequence)
          result.value = emptyResponse("error", "PUBLIC_PROJECTION_UNAVAILABLE");
      } finally {
        if (pending?.sequence === sequence) pending = null;
      }
    })();
    pending = { locale: requested, sequence, promise };
    return promise;
  }

  watch(locale, () => {
    result.value = emptyResponse("loading", null);
    void load();
  }, { flush: "sync" });

  onServerPrefetch(load);
  // Prerendered HTML is only a fast first paint. Revalidate once in the
  // browser so price, eligibility, campaign and maintenance projections do
  // not remain frozen at build time.
  onMounted(() => {
    void load();
  });
  onBeforeUnmount(() => {
    requestSequence += 1;
    clearNuxtState(stateKey);
  });

  function getFacet(name: PublicProjectionFacet): PublicFacetStatus {
    const facet = result.value.facets?.[name];
    return isFacetStatus(facet) ? facet : {
      state: "error",
      updatedAt: null,
      errorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
      stale: false,
    };
  }

  return { projection: result, loadState: result, locale, load, getFacet };
}
