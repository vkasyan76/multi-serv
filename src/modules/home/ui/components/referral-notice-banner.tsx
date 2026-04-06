import { REFERRAL_NOTICE_COOKIE } from "@/constants";
import { ReferralNotice } from "./referral-notice";
import { cookies } from "next/headers";

export const ReferralNoticeBanner = async () => {
  const jar = await cookies();
  const refNoticeRaw = jar.get(REFERRAL_NOTICE_COOKIE)?.value ?? null;

  return <ReferralNotice notice={refNoticeRaw} />;
};
