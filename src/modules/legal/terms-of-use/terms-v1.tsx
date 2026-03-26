import {
  SERVICE_ACTION_DEADLINE_DAYS,
  PAYMENT_DEADLINE_DAYS,
  CANCELLATION_WINDOW_HOURS,
  COMMISSION_RATE_BPS_DEFAULT,
  SERVICE_STATUSES,
  BOOKING_PAYMENT_STATUSES,
} from "@/constants";
import { TermsConsent } from "./terms-consent";

export const TERMS_V1 = {
  version: "v1",
  effectiveDate: "2025-12-25", // set this manually when you publish
};

export function TermsV1({ hideConsent = false }: { hideConsent?: boolean }) {
  const commissionPercent = (COMMISSION_RATE_BPS_DEFAULT / 100).toFixed(2);

  return (
    <article className="space-y-6">
      <header className="space-y-2 text-center border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-semibold">
          Infinisimo Terms of Use
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Version: {TERMS_V1.version} • Effective date: {TERMS_V1.effectiveDate}
        </p>
      </header>

      <div className="space-y-5 leading-7 text-sm sm:text-base">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Role of the Platform</h2>
          <p className="whitespace-pre-wrap">
            Infinisimo operates as an intermediary marketplace. We provide the
            technical platform that enables customers to discover service
            providers, request bookings, and (where applicable) pay providers.
            Services are performed by independent providers, not by Infinisimo.
          </p>
          <p className="whitespace-pre-wrap">
            Providers are solely responsible for the quality, legality, safety,
            and performance of the services they offer and deliver. Infinisimo
            does not guarantee service outcomes and is not a party to the
            service contract except where mandatory consumer law requires.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Booking Lifecycle</h2>
          <p className="whitespace-pre-wrap">
            Bookings reserve a time slot with a provider. The platform uses the
            following lifecycle concepts:
          </p>

          <div className="space-y-2">
            <p className="font-medium">Service status (system values):</p>
            <ul className="list-disc pl-6">
              {SERVICE_STATUSES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>

            <p className="font-medium">Payment status (system values):</p>
            <ul className="list-disc pl-6">
              {BOOKING_PAYMENT_STATUSES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Cancellations</h2>
          <p className="whitespace-pre-wrap">
            Cancellations may be allowed only within the applicable cancellation
            window. By default, the platform uses:
          </p>
          <ul className="list-disc pl-6">
            <li>
              Cancellation window: {CANCELLATION_WINDOW_HOURS} hours before the
              booking start time (default).
            </li>
          </ul>
          <p className="whitespace-pre-wrap">
            Specific cancellation terms may also depend on the provider, the
            service category, and any mandatory consumer law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            4. Confirmations, Disputes, and Deadlines
          </h2>
          <p className="whitespace-pre-wrap">
            The platform may use standard action windows to support reminders,
            operational follow-up, and dispute handling. Unless explicitly
            stated for a specific workflow, these windows do not by themselves
            create automatic acceptance, automatic proof of service delivery,
            or automatic waiver of rights:
          </p>
          <ul className="list-disc pl-6">
            <li>
              Service action window: customers should confirm completion within{" "}
              {SERVICE_ACTION_DEADLINE_DAYS} days after the provider marks the
              service as completed. If the customer believes the service was
              not completed as agreed, the customer should promptly contact the
              provider and may also contact Infinisimo support for
              platform-related assistance.
            </li>
            <li>
              Payment window: where an invoice is issued and becomes payable
              under the applicable booking flow, the customer should pay within{" "}
              {PAYMENT_DEADLINE_DAYS} days or contact support if there is an
              issue.
            </li>
          </ul>
          <p className="whitespace-pre-wrap">
            A provider&apos;s completion notice does not by itself constitute proof
            of service delivery. Customer inactivity does not automatically
            constitute acceptance unless explicitly stated for a specific
            workflow.
          </p>
          <p className="whitespace-pre-wrap">
            If a customer or provider reports a dispute or service issue, the
            platform may request information from both parties and apply
            platform support workflows. Providers and customers remain
            responsible for cooperating in good faith.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            5. Payments and Platform Fee
          </h2>
          <p className="whitespace-pre-wrap">
            Where the platform supports payments, payments are processed to the
            provider. The platform may charge a commission and/or fees for
            providing marketplace and payment infrastructure.
          </p>
          <ul className="list-disc pl-6">
            <li>
              Customer fee policy: customers pay the booking total shown at
              checkout (including any applicable taxes). Infinisimo does not
              add a separate customer-facing platform fee at this time unless
              explicitly shown before payment.
            </li>
            <li>
              Default platform commission rate: {commissionPercent}% (derived
              from {COMMISSION_RATE_BPS_DEFAULT} bps). Promotional,
              campaign-specific, or negotiated commission rates may apply to
              eligible providers or transactions as separately communicated and
              reflected at checkout/invoice creation.
            </li>
            <li>
              Provider fee policy: providers (tenants) authorize Infinisimo and
              Stripe to collect applicable platform commission and Stripe
              processing fees from platform-processed payments. In Stripe,
              these can appear as an application fee (platform) and Stripe
              processing fees.
            </li>
            <li>
              Referral-based campaigns may require referral attribution data to
              determine eligibility.
            </li>
            <li>
              Platform payments are currently supported in EUR only. Payment
              availability, supported payment methods, and currency support may
              depend on the provider&apos;s connected payment account setup. If EUR is
              not supported for a provider&apos;s account, platform payments may be
              unavailable for that provider.
            </li>
            <li>Platform payments are processed via Stripe where enabled.</li>
            <li>
              Payment handling and redirects: the payment step is hosted by
              Stripe Checkout where enabled. Stripe fee schedules and
              classifications are set by Stripe and may vary by payment method,
              card region, and account setup, and may change over time.
            </li>
            <li>
              VAT registration on the platform is available for EU providers
              only, and EU VAT IDs may be validated. Providers remain
              responsible for tax compliance and issuing required
              invoices/receipts.
            </li>
          </ul>
          <p className="whitespace-pre-wrap">
            Taxes (including VAT) are handled according to applicable rules and
            the provider&apos;s tax status. Providers are responsible for issuing any
            required invoices/receipts and complying with tax obligations.
          </p>
          <p className="whitespace-pre-wrap">
            Refunds and disputes. Payments processed through the platform may be
            refunded by the provider or by Infinisimo on the provider&apos;s behalf as
            part of platform support or dispute workflows. Refunds are issued
            against the provider&apos;s connected payment account balance.
            Application fees charged by the platform are refunded only if
            explicitly reversed. Stripe processing fees may be non-refundable
            according to Stripe&apos;s policies. Providers remain responsible for
            refunds, disputes, and related payment obligations associated with
            their services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Prohibited Use</h2>
          <ul className="list-disc pl-6">
            <li>Fraud, chargeback abuse, or misrepresentation.</li>
            <li>Harassment, threats, or unlawful conduct.</li>
            <li>Attempts to bypass platform payments where applicable.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Support</h2>
          <p className="whitespace-pre-wrap">
            For platform-related issues, contact Infinisimo support. For service
            execution issues, the primary counterpart is the provider, except
            where platform dispute workflows apply.
          </p>
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
