import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, Linkedin, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t">
      <div className="wrapper p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
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
            <span className="text-sm hidden sm:inline">
              info@infinisimo.com
            </span>
          </a>
        </nav>

        {/* Copyright */}
        <p className="text-center sm:text-right text-sm text-gray-600">
          © 2025 Infinisimo. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
