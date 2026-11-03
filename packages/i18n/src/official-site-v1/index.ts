import { officialSiteV1Common } from "./common";
import { officialSiteV1Home } from "./home";
import { officialSiteV1Core } from "./core";
import { officialSiteV1Experience } from "./experience";
import { officialSiteV1Info } from "./info";

/** Per-page message namespaces stay independent; the existing i18n fallback applies. */
export const officialSiteV1Messages = {
  common: officialSiteV1Common,
  home: officialSiteV1Home,
  core: officialSiteV1Core,
  experience: officialSiteV1Experience,
  info: officialSiteV1Info,
} as const;
