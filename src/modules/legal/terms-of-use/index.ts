import { TERMS_VERSION } from "@/constants";
import { TERMS_V1, TermsV1 } from "./terms-v1";

export { TERMS_V1, TermsV1 };

export const CURRENT_TERMS = {
  version: TERMS_VERSION,
  effectiveDate: TERMS_V1.effectiveDate,
  Component: TermsV1,
} as const;
