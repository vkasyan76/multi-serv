"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: string | null;
  className?: string;
  label?: string; // tooltip + a11y label
  size?: number; // px
};

const FALLBACK_ICON = "lucide:tag";

function toKebabCase(input: string) {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function normalizeIconName(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // If already Iconify-like: "mdi:broom", "lucide:car", etc.
  if (s.includes(":") || s.startsWith("@")) return s.toLowerCase();

  // If stored as "Car", "Wrench", "Broom" etc.
  const kebab = toKebabCase(s);

  // map "Broom" to a known set you want (you chose MDI here)
  if (kebab === "broom") return "mdi:broom";

  // default: lucide set inside Iconify
  return `lucide:${kebab}`;
}

export function CategoryIcon({ icon, className, label, size = 16 }: Props) {
  const normalized = normalizeIconName(icon) ?? FALLBACK_ICON;
  const decorative = !label;

  const node = (
    <Icon
      icon={normalized}
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      aria-hidden={decorative}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
    />
  );

  // "title" lives on a wrapper, not on <Icon/>
  return label ? <span title={label}>{node}</span> : node;
}

// libraries you can use with @iconify/react
// lucide:* (Lucide)
// mdi:* (Material Design Icons)
// tabler:* (Tabler Icons)
// ph:* (Phosphor)
// fa6-solid:* / fa6-regular:* (Font Awesome 6 via Iconify)
// carbon:* (IBM Carbon)
// heroicons:* (Heroicons)
