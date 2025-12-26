import {
  AUTO_CONFIRM_DAYS_DEFAULT,
  SERVICE_ACTION_DEADLINE_DAYS,
  PAYMENT_DEADLINE_DAYS,
  CANCELLATION_WINDOW_HOURS,
  COMMISSION_RATE_BPS_DEFAULT,
  DISPUTE_WINDOW_DAYS_DEFAULT,
  BOOKING_SERVICE_STATUSES,
  BOOKING_PAYMENT_STATUSES,
} from "@/constants";
import { PolicyConsent } from "./terms-consent";

export const TERMS_V1 = {
  version: "v1",
  effectiveDate: "2025-12-25", // set this manually when you publish
};

export function TermsV1() {
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
              {BOOKING_SERVICE_STATUSES.map((s) => (
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
            The platform uses deadline defaults to keep bookings, confirmations,
            payments, and disputes predictable:
          </p>
          <ul className="list-disc pl-6">
            <li>
              Service action deadline (confirm or dispute):{" "}
              {SERVICE_ACTION_DEADLINE_DAYS} days (default).
            </li>
            <li>
              Payment deadline (pay or dispute after confirmation):{" "}
              {PAYMENT_DEADLINE_DAYS} days (default).
            </li>
            <li>
              Auto-confirm after completion: {AUTO_CONFIRM_DAYS_DEFAULT} days
              (default).
            </li>
            <li>
              Dispute window after service completion:{" "}
              {DISPUTE_WINDOW_DAYS_DEFAULT} days (default).
            </li>
          </ul>
          <p className="whitespace-pre-wrap">
            If a dispute is raised, the platform may request information from
            both parties and apply platform workflows. Providers and customers
            remain responsible for cooperating in good faith.
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
              Default platform commission rate: {commissionPercent}% (derived
              from {COMMISSION_RATE_BPS_DEFAULT} bps).
            </li>
          </ul>
          <p className="whitespace-pre-wrap">
            Taxes (including VAT) are handled according to applicable rules and
            the provider’s tax status. Providers are responsible for issuing any
            required invoices/receipts and complying with tax obligations.
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
      <div className="pt-4">
        <PolicyConsent />
      </div>
    </article>
  );
}
