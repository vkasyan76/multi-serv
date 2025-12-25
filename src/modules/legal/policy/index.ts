export { POLICY_V1, PolicyV1 } from "./policy-v1";

// Later:
// export { POLICY_V2, PolicyV2 } from "./policy-v2";

export const CURRENT_POLICY = {
  version: "v1",
  effectiveDate: "2025-12-25",
  Component: "PolicyV1",
} as const;
