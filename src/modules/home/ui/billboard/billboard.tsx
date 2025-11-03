"use client";

import Image from "next/image";
import * as React from "react";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };

type HV = "left" | "center" | "right";
type VAnchor = "top" | "middle" | "bottom";

export type BillboardProps = {
  imageSrc: string;
  alt?: string;

  slogan: string;
  cta: string;

  sloganPos?: Pos; // default { x: 8,  y: 50 }  (left, middle)
  ctaPos?: Pos; // default { x: 8,  y: 96 }  (left, bottom)

  sloganStyle?: React.CSSProperties;
  ctaStyle?: React.CSSProperties;

  /** independent alignment/anchors */
  sloganAlign?: HV; // default "left"
  sloganAnchorY?: VAnchor; // default "middle"
  ctaAlign?: HV; // default "left"
  ctaAnchorY?: VAnchor; // default "bottom"

  overlayColor?: string;
  rounded?: string;
  className?: string;
  fontClassName?: string;

  sloganClassName?: string; // e.g. "text-3xl md:text-5xl"
  ctaClassName?: string; // e.g. "text-sm md:text-lg"
  ratio?: "portrait" | "square" | "landscape";
};

// compute CSS transform for our anchor
function transformFor(h: HV, v: VAnchor) {
  const tx = h === "center" ? "-50%" : h === "right" ? "-100%" : "0"; // left/center/right
  const ty = v === "middle" ? "-50%" : v === "bottom" ? "-100%" : "0"; // top/middle/bottom
  // avoid adding translateX(0)/translateY(0) so browser doesn’t pay unnecessary cost
  const parts = [];
  if (tx !== "0") parts.push(`translateX(${tx})`);
  if (ty !== "0") parts.push(`translateY(${ty})`);
  return parts.length ? parts.join(" ") : undefined;
}

export default function Billboard({
  imageSrc,
  alt = "",
  slogan,
  cta,
  sloganPos = { x: 24, y: 72 },
  ctaPos = { x: 8, y: 96 },
  sloganStyle,
  ctaStyle,
  sloganAlign = "left",
  sloganAnchorY = "middle",
  ctaAlign = "left",
  ctaAnchorY = "bottom",
  overlayColor,
  rounded = "rounded-2xl",
  className = "",
  fontClassName = "",
  sloganClassName = "text-3xl sm:text-4xl md:text-5xl",
  ctaClassName = "text-sm sm:text-base md:text-lg",
  ratio = "portrait",
}: BillboardProps) {
  const ratioClass =
    ratio === "portrait"
      ? "aspect-[3/4]"
      : ratio === "landscape"
        ? "aspect-[16/9]"
        : "aspect-square";

  return (
    <div
      className={cn(
        rounded,
        "relative w-full overflow-hidden shadow-sm",
        ratioClass,
        className
      )}
      aria-label="Billboard"
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes="(min-width:1024px) 34vw, 100vw"
        className="object-cover"
        priority
      />

      {overlayColor && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlayColor }}
        />
      )}

      {/* Slogan: left + vertically centered */}
      <div
        className={cn("absolute text-white", fontClassName, sloganClassName)}
        style={{
          left: `${sloganPos.x}%`,
          top: `${sloganPos.y}%`,
          transform: transformFor(sloganAlign, sloganAnchorY),
          ...sloganStyle,
        }}
      >
        <span className="block leading-tight drop-shadow-sm">{slogan}</span>
      </div>

      {/* CTA: left + bottom */}
      <div
        className={cn("absolute text-white", fontClassName, ctaClassName)}
        style={{
          left: `${ctaPos.x}%`,
          top: `${ctaPos.y}%`,
          transform: transformFor(ctaAlign, ctaAnchorY),
          ...ctaStyle,
        }}
      >
        <span className="block leading-tight drop-shadow-sm whitespace-pre-line">
          {cta}
        </span>
      </div>
    </div>
  );
}
