import {
  SERVICE_ACTION_DEADLINE_DAYS,
  PAYMENT_DEADLINE_DAYS,
  CANCELLATION_WINDOW_HOURS,
  COMMISSION_RATE_BPS_DEFAULT,
  SERVICE_STATUSES,
  BOOKING_PAYMENT_STATUSES,
} from "@/constants";
import { getTranslations } from "next-intl/server";
import { TermsConsent } from "./terms-consent";

export const TERMS_V1 = {
  version: "v1",
  effectiveDate: "2025-12-25", // set this manually when you publish
};

export async function TermsV1({
  hideConsent = false,
}: {
  hideConsent?: boolean;
}) {
  const t = await getTranslations("legalTerms");
  const tOrders = await getTranslations("orders");
  const tBookings = await getTranslations("bookings");
  const commissionPercent = (COMMISSION_RATE_BPS_DEFAULT / 100).toFixed(2);

  return (
    <article className="space-y-6">
      <header className="space-y-2 text-center border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold">
          {t("meta.title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("meta.version_label")}: {TERMS_V1.version} {"|"}{" "}
          {t("meta.effective_date_label")}: {TERMS_V1.effectiveDate}
        </p>
      </header>

      <div className="space-y-5 leading-7 text-sm sm:text-base">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section1.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section1.p1")}</p>
          <p className="whitespace-pre-wrap">{t("section1.p2")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section2.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section2.p1")}</p>

          <div className="space-y-2">
            <p className="font-medium">{t("section2.service_status_label")}</p>
            <ul className="list-disc pl-6">
              {SERVICE_STATUSES.map((s) => (
                <li key={s}>{tOrders(`status.${s}`)}</li>
              ))}
            </ul>

            <p className="font-medium">{t("section2.payment_status_label")}</p>
            <ul className="list-disc pl-6">
              {BOOKING_PAYMENT_STATUSES.map((s) => (
                <li key={s}>{tBookings(`payment_status.${s}`)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section3.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section3.p1")}</p>
          <ul className="list-disc pl-6">
            <li>
              {t("section3.cancellation_window", {
                hours: CANCELLATION_WINDOW_HOURS,
              })}
            </li>
          </ul>
          <p className="whitespace-pre-wrap">{t("section3.p2")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section4.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section4.p1")}</p>
          <ul className="list-disc pl-6">
            <li>
              {t("section4.service_action_window", {
                serviceActionDays: SERVICE_ACTION_DEADLINE_DAYS,
              })}
            </li>
            <li>
              {t("section4.payment_window", {
                paymentDays: PAYMENT_DEADLINE_DAYS,
              })}
            </li>
          </ul>
          <p className="whitespace-pre-wrap">{t("section4.p2")}</p>
          <p className="whitespace-pre-wrap">{t("section4.p3")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section5.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section5.p1")}</p>
          <ul className="list-disc pl-6">
            <li>{t("section5.customer_fee_policy")}</li>
            <li>
              {t("section5.commission_rate", {
                commissionPercent,
                commissionBps: COMMISSION_RATE_BPS_DEFAULT,
              })}
            </li>
            <li>{t("section5.provider_fee_policy")}</li>
            <li>{t("section5.referral_policy")}</li>
            <li>{t("section5.eur_only")}</li>
            <li>{t("section5.stripe_enabled")}</li>
            <li>{t("section5.payment_handling")}</li>
            <li>{t("section5.vat_registration")}</li>
          </ul>
          <p className="whitespace-pre-wrap">{t("section5.p2")}</p>
          <p className="whitespace-pre-wrap">{t("section5.p3")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section6.title")}</h2>
          <ul className="list-disc pl-6">
            <li>{t("section6.item1")}</li>
            <li>{t("section6.item2")}</li>
            <li>{t("section6.item3")}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("section7.title")}</h2>
          <p className="whitespace-pre-wrap">{t("section7.p1")}</p>
        </section>
      </div>
      {!hideConsent && (
        <div className="pt-4">
          <TermsConsent />
        </div>
      )}
    </article>
  );
}
