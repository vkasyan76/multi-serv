"use client";

import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";
import clsx from "clsx";

type SettingsHeaderProps = {
  title: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
  /** Optional right-side content (e.g., extra buttons) */
  children?: React.ReactNode;
};

export default function SettingsHeader({
  title,
  homeHref = "/",
  homeLabel = "Home",
  className,
  children,
}: SettingsHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        "gap-4 mb-6",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <Image
          src="/images/infinisimo_logo_illustrator.png"
          alt="Infinisimo Logo"
          width={44}
          height={44}
          className="rounded-full bg-white"
          priority
        />
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {children}
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2
                     bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Home className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm sm:text-base font-medium">{homeLabel}</span>
        </Link>
      </div>
    </div>
  );
}
