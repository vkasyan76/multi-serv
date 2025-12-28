import { TRPCError } from "@trpc/server";
import { TERMS_VERSION } from "@/constants";
import type { User } from "@/payload-types";

type AcceptanceFields = Pick<
  User,
  "policyAcceptedVersion" | "policyAcceptedAt"
>;

export function hasAcceptedCurrentTerms(
  u: AcceptanceFields | null | undefined
) {
  return (
    !!u && u.policyAcceptedVersion === TERMS_VERSION && !!u.policyAcceptedAt
  );
}

export function assertTermsAccepted(u: AcceptanceFields | null | undefined) {
  if (!hasAcceptedCurrentTerms(u)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You must accept the Terms of Use before continuing.",
    });
  }
}
