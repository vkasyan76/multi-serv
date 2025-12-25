import { POLICY_VERSION } from "@/constants";
import { POLICY_V1, PolicyV1 } from "./policy-v1";

// Later:
// import { POLICY_V2, PolicyV2 } from "./policy-v2";

export { POLICY_V1, PolicyV1 };

export const CURRENT_POLICY = {
  version: POLICY_VERSION,
  effectiveDate: POLICY_V1.effectiveDate,
  Component: PolicyV1,
} as const;
