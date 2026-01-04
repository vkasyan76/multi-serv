import { OpenCookiePreferencesLink } from "@/modules/legal/cookies/ui/open-cookie-preferences-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cookies",
};

export default function CookiesPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground">
          We use cookies to keep the site working and (optionally) to measure
          and improve usage. You can change your choices at any time.
        </p>

        <OpenCookiePreferencesLink className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-pink-400 hover:text-primary">
          Open cookie preferences
        </OpenCookiePreferencesLink>
      </header>

      <section className="space-y-3 text-sm sm:text-base leading-7">
        <h2 className="text-lg font-semibold">Types of cookies</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Essential:</strong> required for core functionality (cannot
            be turned off).
          </li>
          <li>
            <strong>Marketing & analytics:</strong> helps us understand usage
            and improve the product (optional).
          </li>
          <li>
            <strong>Advertising:</strong> used to measure/personalize
            advertising (optional).
          </li>
        </ul>

        <h2 className="text-lg font-semibold">How to change your choices</h2>
        <p>
          Use the “Cookie preferences” link in the site footer, or the button
          above.
        </p>
      </section>
    </article>
  );
}
