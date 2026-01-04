import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          This policy explains how Infinisimo processes personal data.
        </p>
      </header>

      <div className="space-y-4 leading-7 text-sm sm:text-base">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Controller</h2>
          <p>
            Provider / Operator: Valentyn Kasyan (see Impressum). Contact:
            info@infinisimo.com
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Data we process</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Account & profile data (e.g., email, name, username).</li>
            <li>
              Service usage data (e.g., actions taken in the app, basic logs for
              security).
            </li>
            <li>
              Location data (if provided by you, and/or approximate location
              derived from IP for basic localization).
            </li>
            <li>
              Payment-related data is processed via payment providers (e.g.,
              Stripe) for checkout and payouts.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Purposes</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Provide authentication and account access (e.g., via Clerk).
            </li>
            <li>
              Provide marketplace functionality (profiles, bookings, payments).
            </li>
            <li>Security, abuse prevention, and troubleshooting.</li>
            <li>
              Optional analytics/advertising only where you have consented (see
              Cookies).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Cookies</h2>
          <p>
            For cookie categories and choices, see the{" "}
            <Link href="/legal/cookies" className="underline">
              Cookie Policy
            </Link>
            . You can change cookie preferences at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your rights</h2>
          <p>
            Depending on your location (including GDPR), you may have rights to
            access, rectify, delete, restrict processing, object, and data
            portability, and to withdraw consent for optional processing.
            Contact: info@infinisimo.com
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p>
            We may update this policy from time to time. Material changes will
            be reflected on this page.
          </p>
        </section>
      </div>
    </article>
  );
}
