import {
  EMPTY_PUBLIC_PROJECTION,
  normalizePublicProjectionResponse,
  resolvePublicUiLocale,
  type PublicProjectionResponse,
  type PublicUiLocale,
} from "~/utils/public-projection";
import { resolveGatewayBaseUrl } from "~/utils/gateway";

type PublicGatewayResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};
type PublicGatewayRequest = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<PublicGatewayResponse>;

type PublicGatewayPayload = Record<string, unknown>;

function isRecord(value: unknown): value is PublicGatewayPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function usableContentPayload(value: unknown): value is PublicGatewayPayload {
  if (!isRecord(value)) return false;
  const wrappers = ["publicProjection", "data", "result"] as const;
  // An explicitly malformed wrapper must never fall back to sibling data.
  if (wrappers.some((key) => Object.hasOwn(value, key) && !isRecord(value[key]))) return false;
  if (Object.hasOwn(value, "meta") && !isRecord(value.meta)) return false;
  const wrapper = wrappers.find((key) => isRecord(value[key]));
  const content = wrapper && isRecord(value[wrapper]) ? value[wrapper] : value;
  const layers: PublicGatewayPayload[] = [value];
  for (const key of wrappers) {
    const candidate = value[key];
    if (isRecord(candidate)) layers.push(candidate);
  }
  if (isRecord(value.meta)) layers.push(value.meta);
  if (layers.some((layer) => Object.hasOwn(layer, "stale") && typeof layer.stale !== "boolean")) return false;
  const collections = ["courses", "pricingPlans", "pricing", "prices", "skus", "publicSkus", "campaigns", "activities", "promotions", "downloadChannels", "downloads", "announcements", "notices", "complianceNotices", "compliance"];
  if (collections.some((key) => Object.hasOwn(content, key))) return true;
  // A no-content denial/maintenance response must retain its explicit state;
  // an otherwise empty object cannot prove that the catalog is truly empty.
  return layers.some((layer) => [layer.state, layer.serviceState, layer.projectionState, layer.accessState]
    .some((state) => typeof state === "string" && ["permission", "forbidden", "denied", "access-denied", "error", "failed", "unavailable", "maintenance", "maintaining"]
      .includes(state.toLowerCase().replaceAll("_", "-"))) || layer.maintenance === true);
}

function publicCommerceCatalog(value: unknown): PublicGatewayPayload | null {
  if (!isRecord(value)) return null;
  // Check the data/plans shape when an envelope is present. Never fall back
  // to a sibling legacy field when that shape is malformed.
  if (Object.hasOwn(value, "data")) {
    return isRecord(value.data) && Array.isArray(value.data.plans) ? value.data : null;
  }
  return Array.isArray(value.plans) ? value : null;
}

function publicCommercePrices(commerce: PublicGatewayPayload, locale: PublicUiLocale): PublicGatewayPayload[] | null {
  if (!Array.isArray(commerce.plans)) return null;
  const pricing: PublicGatewayPayload[] = [];
  const allowedFields = new Set(["planId", "skuId", "title", "billingPeriod", "currency", "amountMinor", "priceSnapshotId", "availability", "entitlementCode"]);
  for (const plan of commerce.plans) {
    if (!isRecord(plan) || Object.keys(plan).some((key) => !allowedFields.has(key))) return null;
    const requiredText = (key: string, maxLength: number) => {
      const value = plan[key];
      return typeof value === "string" && Array.from(value).length <= maxLength ? value.trim() : "";
    };
    const planId = requiredText("planId", 128);
    const skuId = requiredText("skuId", 128);
    const name = requiredText("title", 160);
    const currency = typeof plan.currency === "string" ? plan.currency : "";
    const billingPeriod = typeof plan.billingPeriod === "string" ? plan.billingPeriod : "";
    const availability = typeof plan.availability === "string" ? plan.availability : "";
    const entitlementCode = requiredText("entitlementCode", 96);
    const priceSnapshotId = requiredText("priceSnapshotId", 128);
    const amountMinor = plan.amountMinor;
    if (!planId || !skuId || !name || !/^[A-Z]{3}$/.test(currency)
      || !["FREE", "MONTH", "QUARTER", "YEAR", "PERPETUAL"].includes(billingPeriod)
      || !["PUBLISHED", "COMING_SOON", "UNAVAILABLE"].includes(availability)
      || (billingPeriod === "PERPETUAL" && availability === "PUBLISHED")
      || !entitlementCode || !priceSnapshotId
      || typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
    let price: string;
    try {
      const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
      const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
      price = formatter.format(amountMinor / (10 ** digits));
    } catch { return null; }
    pricing.push({
      id: skuId,
      skuId,
      name,
      price,
      unit: billingPeriod,
      currency,
      billingPeriod,
      features: [],
      availability,
      entitlementCode,
      priceSnapshotId,
    });
  }
  return pricing;
}

function mergeCommercePricing(projection: unknown, pricing: PublicGatewayPayload[]): unknown {
  if (!isRecord(projection)) return projection;
  // Match sourceData's precedence so new commerce facts replace old prices in
  // the exact supported wrapper that the normalizer will subsequently read.
  const wrapper = (["publicProjection", "data", "result"] as const)
    .find((key) => isRecord(projection[key]));
  const data = wrapper && isRecord(projection[wrapper]) ? projection[wrapper] : projection;
  // Only the public, field-filtered catalog is merged; any invalid plan makes
  // the commerce facet unavailable instead of turning a partial catalog empty.
  // Commerce owns public offers. A missing or empty catalog must also clear
  // prices and SKUs carried by an older content projection.
  const mergedData = { ...data, pricingPlans: pricing, skus: [] };
  return wrapper ? { ...projection, [wrapper]: mergedData } : mergedData;
}

const LAST_GOOD_MAX_AGE_MS = 60_000;
const lastGoodProjectionByLocale = new Map<
  PublicUiLocale,
  { response: PublicProjectionResponse; fetchedAt: number }
>();
const invalidationByLocale = new Map<PublicUiLocale, { generation: number; state: "permission" | "error" }>();
const latestAppliedRequestByLocale = new Map<PublicUiLocale, number>();
let nextRequestId = 0;

function invalidate(locale: PublicUiLocale, state: "permission" | "error"): void {
  const generation = (invalidationByLocale.get(locale)?.generation ?? 0) + 1;
  invalidationByLocale.set(locale, { generation, state });
  lastGoodProjectionByLocale.delete(locale);
}

function emptyFallback(state: "permission" | "error"): PublicProjectionResponse {
  const errorCode = state === "permission" ? "PUBLIC_PROJECTION_PERMISSION" : "PUBLIC_PROJECTION_UNAVAILABLE";
  const facets = {
    courses: { state, updatedAt: null, errorCode, stale: false },
    pricing: { state, updatedAt: null, errorCode, stale: false },
    download: { state, updatedAt: null, errorCode, stale: false },
    announcements: { state, updatedAt: null, errorCode, stale: false },
    compliance: { state, updatedAt: null, errorCode, stale: false },
  } as PublicProjectionResponse["facets"];
  return {
    projection: EMPTY_PUBLIC_PROJECTION,
    state,
    stale: false,
    source: "empty-fallback",
    errorCode,
    facets,
    commerceState: state,
    commerceErrorCode: errorCode,
  };
}

function joinPath(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default defineEventHandler(
  async (event): Promise<PublicProjectionResponse> => {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);
    const locale = resolvePublicUiLocale(query.locale);
    const requestId = ++nextRequestId;
    const initialGeneration = invalidationByLocale.get(locale)?.generation ?? 0;
    const projectionPath = String(
      config.public.publicProjectionPath || "/public/site/projection",
    );
    // Keep failures out of shared caches. Only a complete public response gets
    // the short cache lifetime below.
    setResponseHeader(event, "cache-control", "no-store");
    setResponseHeader(event, "vary", "Accept-Language");

    const rejectInvalidContent = (payload: unknown): PublicProjectionResponse => {
      const latest = invalidationByLocale.get(locale);
      setResponseHeader(event, "x-public-projection-source", "empty-fallback");
      // A late malformed response cannot replace a newer denial or successful
      // decision. It still returns no public facts to its own caller.
      if ((latest?.generation ?? 0) !== initialGeneration)
        return emptyFallback(latest?.state ?? "error");
      if (requestId < (latestAppliedRequestByLocale.get(locale) ?? 0))
        return emptyFallback("error");
      latestAppliedRequestByLocale.set(locale, requestId);
      const state = normalizePublicProjectionResponse(payload, locale).state === "permission" ? "permission" : "error";
      invalidate(locale, state);
      return emptyFallback(state);
    };

    let accessDenied = false;
    try {
      const internalBase = String(config.gatewayInternalBaseUrl || "").trim();
      const gatewayBase = resolveGatewayBaseUrl(
        internalBase || config.public.gatewayBaseUrl,
        "",
      );
      if (!/^https?:\/\//i.test(gatewayBase))
        throw new Error("PUBLIC_PROJECTION_GATEWAY_URL_INVALID");
      const gatewayUrl = joinPath(gatewayBase, projectionPath);
      const request = Reflect.get(globalThis, "fetch") as
        PublicGatewayRequest | undefined;
      if (typeof request !== "function")
        throw new Error("SSR public request unavailable");
      const response = await request(
        gatewayUrl + `?uiLocale=${encodeURIComponent(locale)}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(2500),
        },
      );
      if (response.status === 401 || response.status === 403) {
        accessDenied = true;
        invalidate(locale, "permission");
      } else if (response.status === 404 || response.status === 410) {
        invalidate(locale, "error");
      }
      if (!response.ok)
        throw new Error(`PUBLIC_PROJECTION_HTTP_${response.status}`);
      let projectionPayload: unknown;
      try {
        projectionPayload = await response.json();
      } catch {
        return rejectInvalidContent(null);
      }
      if (!usableContentPayload(projectionPayload)) return rejectInvalidContent(projectionPayload);
      let mergedPayload: unknown = mergeCommercePricing(projectionPayload, []);
      let commerceDegraded = false;
      try {
        const commerceUrl = joinPath(gatewayBase, "/public/commerce/catalog");
        const commerceResponse = await request(
          commerceUrl + `?uiLocale=${encodeURIComponent(locale)}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(2500),
          },
        );
        if (commerceResponse.ok) {
          const commercePayload = await commerceResponse.json();
          const catalog = publicCommerceCatalog(commercePayload);
          const pricing = catalog ? publicCommercePrices(catalog, locale) : null;
          if (pricing !== null) {
            mergedPayload = mergeCommercePricing(projectionPayload, pricing);
            setResponseHeader(event, "x-public-projection-commerce", "gateway");
          } else {
            commerceDegraded = true;
            setResponseHeader(event, "x-public-projection-commerce", "degraded");
          }
        } else {
          commerceDegraded = true;
          setResponseHeader(event, "x-public-projection-commerce", "degraded");
        }
      } catch {
        // Content remains usable when commerce is temporarily unavailable. The
        // UI will show the projection's honest empty pricing state instead of a
        // fabricated plan or a network error for unrelated public content.
        commerceDegraded = true;
        setResponseHeader(event, "x-public-projection-commerce", "degraded");
      }
      const normalized = normalizePublicProjectionResponse(
        {
          ...(isRecord(mergedPayload) ? mergedPayload : {}),
          commerceState: commerceDegraded ? "error" : "ready",
          commerceErrorCode: commerceDegraded ? "PUBLIC_COMMERCE_DEGRADED" : null,
          commerceDegraded,
        },
        locale,
      );
      // 合法 recovery：保留经过字段过滤的可读公开数据、更新时间、旧数据
      // 标记与恢复原因；permission/error/maintenance 仍按不可读处理。
      const keepRecoveryData = normalized.state === "recovery";
      const result: PublicProjectionResponse = {
        ...normalized,
        projection: normalized.state === "ready" || keepRecoveryData ? normalized.projection : EMPTY_PUBLIC_PROJECTION,
        source: "gateway",
        stale: keepRecoveryData ? true : false,
        errorCode: keepRecoveryData
          ? (normalized.errorCode ?? "PUBLIC_PROJECTION_STALE")
          : commerceDegraded ? normalized.errorCode : null,
      };
      const latestInvalidation = invalidationByLocale.get(locale);
      if ((latestInvalidation?.generation ?? 0) !== initialGeneration
        || requestId < (latestAppliedRequestByLocale.get(locale) ?? 0)) {
        setResponseHeader(event, "x-public-projection-source", "empty-fallback");
        return emptyFallback(latestInvalidation?.state ?? "error");
      }
      latestAppliedRequestByLocale.set(locale, requestId);
      const hasInvalidContentFacet = Object.entries(result.facets).some(([name, facet]) =>
        name !== "pricing" && facet.errorCode === "PUBLIC_FACET_INVALID");
      if (result.state === "ready" && !commerceDegraded && !hasInvalidContentFacet)
        lastGoodProjectionByLocale.set(locale, { response: result, fetchedAt: Date.now() });
      else if (result.state === "recovery" && !hasInvalidContentFacet) {
        // F10: recovery 携带权威内容+commerce 事实。刷新缓存中的事实，使随后的
        // 网络故障不能复活已被清空/替换的旧套餐；保留原 fetchedAt，recovery 永不
        // 延长 60 秒 TTL。无前置缓存时不从 recovery 新建缓存。
        const prior = lastGoodProjectionByLocale.get(locale);
        if (prior) {
          lastGoodProjectionByLocale.set(locale, { response: result, fetchedAt: prior.fetchedAt });
        }
      } else
        invalidate(locale, result.state === "permission" ? "permission" : "error");
      if (!commerceDegraded && !hasInvalidContentFacet && (result.state === "ready" || result.state === "empty"))
        setResponseHeader(
          event,
          "cache-control",
          "public, max-age=60, s-maxage=60",
        );
      setResponseHeader(event, "x-public-projection-source", "gateway");
      return result;
    } catch (error) {
      if (accessDenied) {
        setResponseHeader(event, "x-public-projection-source", "empty-fallback");
        return emptyFallback("permission");
      }
      const lastGoodProjection = lastGoodProjectionByLocale.get(locale);
      const snapshotAge = lastGoodProjection ? Date.now() - lastGoodProjection.fetchedAt : -1;
      if (lastGoodProjection && snapshotAge >= 0 && snapshotAge <= LAST_GOOD_MAX_AGE_MS) {
        // F12: 缓存回填保留已知不可读 facet 的状态及原因；仅对此前成功取得的
        // 可读缓存标记 stale/recovery。pricing facet 与 commerce 信号保持一致。
        const cachedFacets = lastGoodProjection.response.facets;
        const cachedGeneratedAt = lastGoodProjection.response.projection.generatedAt;
        const toOutageFacet = (
          cached: { readonly state: string; readonly updatedAt: string | null; readonly errorCode: string | null; readonly stale: boolean },
        ): PublicProjectionResponse["facets"]["courses"] => {
          if (cached.state === "error" || cached.state === "permission" || cached.state === "maintenance") return { ...cached } as PublicProjectionResponse["facets"]["courses"];
          return { state: "recovery", updatedAt: cachedGeneratedAt, errorCode: "PUBLIC_PROJECTION_STALE", stale: true };
        };
        const outagePricing = toOutageFacet(cachedFacets.pricing);
        const stale: PublicProjectionResponse = {
          ...lastGoodProjection.response,
          state: "recovery",
          stale: true,
          source: "memory-cache",
          errorCode: "PUBLIC_PROJECTION_STALE",
          facets: {
            courses: toOutageFacet(cachedFacets.courses),
            pricing: outagePricing,
            download: toOutageFacet(cachedFacets.download),
            announcements: toOutageFacet(cachedFacets.announcements),
            compliance: toOutageFacet(cachedFacets.compliance),
          },
          commerceState: outagePricing.state,
          commerceErrorCode: outagePricing.errorCode,
        };
        setResponseHeader(event, "x-public-projection-source", "memory-cache");
        return stale;
      }
      lastGoodProjectionByLocale.delete(locale);
      const fallbackFacets = {
        courses: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        pricing: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        download: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        announcements: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        compliance: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
      } as PublicProjectionResponse["facets"];
      const fallback: PublicProjectionResponse = {
        projection: EMPTY_PUBLIC_PROJECTION,
        state: "error",
        stale: false,
        source: "empty-fallback",
        errorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
        facets: fallbackFacets,
        commerceState: "error",
        commerceErrorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
      };
      setResponseHeader(event, "x-public-projection-source", "empty-fallback");
      return fallback;
    }
  },
);
