"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  line1?: string;
  line2?: string;
  className?: string;
  hideOnMobile?: boolean;
  gapAfterLine1?: number; // pause between sentences (sec)
  lineDuration?: number; // duration per line (sec)
};

type CSSVars = React.CSSProperties & {
  "--dl"?: string; // delay
  "--du"?: string; // duration
};

export default function Headline({
  line1 = "We connect clients with professionals.",
  line2 = "Your solution is only a click away.",
  className,
  hideOnMobile = true,
  gapAfterLine1 = 0.1,
  lineDuration = 2.2,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReveal(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const line1Vars: CSSVars = { "--dl": "0s", "--du": `${lineDuration}s` };
  const line2Vars: CSSVars = {
    "--dl": `${lineDuration + gapAfterLine1}s`,
    "--du": `${lineDuration}s`,
  };

  return (
    <section
      ref={hostRef}
      data-reveal={reveal ? "true" : "false"}
      aria-label="Infinisimo headline"
      className={cn(
        "mx-auto max-w-5xl",
        hideOnMobile ? "hidden md:block" : "",
        className
      )}
    >
      <h1 className="leading-[1.05] tracking-tight text-3xl md:text-5xl lg:text-6xl font-semibold text-foreground/90">
        <span className="infin-reveal-wrap" style={line1Vars}>
          {line1}
        </span>
      </h1>

      {line2 && (
        <p className="mt-3 md:mt-4 leading-tight tracking-tight text-xl md:text-3xl lg:text-4xl text-foreground/80 text-center">
          <span className="infin-reveal-wrap" style={line2Vars}>
            {line2}
          </span>
        </p>
      )}

      <style jsx global>{`
        /* Hidden by default to prevent any flash */
        .infin-reveal-wrap {
          display: block; /* allows natural wrapping */
          position: relative;
          clip-path: inset(0 100% 0 0); /* fully hidden from the right */
          opacity: 0;
        }

        /* Smooth wipe; overshoot the right edge to avoid truncation */
        @keyframes infin-clip-wipe {
          to {
            clip-path: inset(
              0 -8% 0 0
            ); /* negative right inset = tiny overshoot */
            opacity: 1;
          }
        }

        /* Run only after the section is in view */
        [data-reveal="true"] .infin-reveal-wrap {
          animation: infin-clip-wipe var(--du, 2.2s) var(--dl, 0s) linear both; /* uniform speed across the whole line */
          will-change: clip-path, opacity;
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          [data-reveal="true"] .infin-reveal-wrap {
            animation: none;
            clip-path: inset(0 0 0 0);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
