"use client";

import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, Linkedin, Mail } from "lucide-react";
import { OpenCookiePreferencesButton } from "@/modules/legal/cookies/ui/open-cookie-preferences-button";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";

export const Footer = () => {
  const t = useTranslations("common");
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  // Footer legal links stay localized without relying on middleware redirects.
  const href = (pathnameWithQuery: string) => {
    const [pathPart, query = ""] = pathnameWithQuery.split("?");
    const localizedPath = withLocalePrefix(pathPart || "/", lang);
    return query ? `${localizedPath}?${query}` : localizedPath;
  };

  return (
    <footer className="border-t">
      <div className="wrapper p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <Link href={href("/")} className="shrink-0">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="Infinisimo logo"
            width={90}
            height={20}
          />
        </Link>

        {/* Socials + email */}
        <nav className="flex items-center gap-4 text-gray-600">
          <a
            href="https://www.instagram.com/info.infinisimo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hover:text-black transition-colors"
            title="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href="https://www.facebook.com/infinisimo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="hover:text-black transition-colors"
            title="Facebook"
          >
            <Facebook className="h-5 w-5" />
          </a>
          <a
            href="https://www.linkedin.com/company/infinisimo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="hover:text-black transition-colors"
            title="LinkedIn"
          >
            <Linkedin className="h-5 w-5" />
          </a>

          {/* Email: icon + text (text hides on very small screens to keep it tidy) */}
          <a
            href="mailto:info@infinisimo.com"
            className="flex items-center gap-2 hover:text-black transition-colors"
            title="Email us"
          >
            <Mail className="h-5 w-5" />
            <span className="text-sm hidden sm:inline">info@infinisimo.com</span>
          </a>
        </nav>

        {/* Legal / Preferences */}
        <nav className="flex items-center gap-4 text-gray-600 text-sm">
          {/* Mirror the navbar entry in the footer so support stays reachable
          even before the actual chat UI lands. */}
          <Link
            href={href("/support")}
            className="hover:text-black transition-colors"
          >
            {t("nav.support")}
          </Link>

          <Link href={href("/legal/terms-of-use")} className="hover:text-black transition-colors">
            {/* Match navbar wording on desktop, keep the shorter footer label on mobile. */}
            <span className="sm:hidden">{t("footer.terms")}</span>
            <span className="hidden sm:inline">{t("nav.terms_of_use")}</span>
          </Link>

          <Link href={href("/legal/impressum")} className="hover:text-black transition-colors">
            {t("footer.impressum")}
          </Link>

          <Link href={href("/legal/cookies")} className="hover:text-black transition-colors">
            {t("footer.cookies")}
          </Link>

          <OpenCookiePreferencesButton className="hover:text-black transition-colors underline underline-offset-2">
            {t("footer.cookie_preferences")}
          </OpenCookiePreferencesButton>
        </nav>

        {/* Copyright */}
        <p className="text-center sm:text-right text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Infinisimo.{" "}
          {t("footer.all_rights_reserved")}
        </p>
      </div>
    </footer>
  );
};

