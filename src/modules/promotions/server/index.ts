export {
  resolvePromotionForCheckout,
  type ResolvePromotionInput,
  type ResolvePromotionResult,
  type WinningPromotion,
} from "./promotion-resolver";

export { buildPromotionCounterKey, type FirstNScope } from "./counter-key";
export { consumePromotionAllocationIfReserved } from "./allocation-consume";
export {
  getReferralPromoForTenantEmail,
  type ReferralPromoForTenantEmail,
} from "./referral-promo-for-tenant";
