"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  isAuthed: boolean;
  isOnboarded: boolean; // “onboarding done” proxy (viewer coords)
  hasTenant: boolean;
  loading?: boolean; // pass session/profile loading to avoid flicker
  className?: string;
  line1FontClass?: string;
  sentinelId?: string;
};

// CSS var typing for style prop
// type VarStyle = React.CSSProperties & { ["--du"]?: string };
type VarStyle = CSSProperties & { ["--du"]?: string };

export default function CallToAction({
  isAuthed,
  isOnboarded,
  hasTenant,
  loading,
  className,
  line1FontClass,
  sentinelId,
}: Props) {
  // Hooks FIRST (fixes rules-of-hooks warning)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const target =
      (sentinelId && document.getElementById(sentinelId)) || hostRef.current;
    if (!target) return;

    const initialY = window.scrollY;

    const maybeReveal = (obs?: IntersectionObserver) => {
      const rect = target.getBoundingClientRect();
      const inView = rect.top <= window.innerHeight && rect.bottom >= 0;
      const userScrolled = window.scrollY > initialY + 1;
      if (inView && userScrolled) {
        setReveal(true);
        if (obs) obs.disconnect();
        window.removeEventListener("scroll", onScroll);
      }
    };

    const onScroll: EventListener = () => {
      if (window.scrollY > initialY + 1) maybeReveal();
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries: IntersectionObserverEntry[], obs: IntersectionObserver) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          // still require some user scroll to have happened
          maybeReveal(obs);
        }
      },
      { rootMargin: "0px 0px -1% 0px", threshold: 0 }
    );

    io.observe(target);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [sentinelId]);

  // If still loading auth/profile, don’t render CTA
  if (loading) return null;

  // Decide which variant to show
  let text: string | null = null;
  let cta: ReactNode = null;

  if (!isAuthed) {
    // Case 1: guest
    text = "Register to localize your search:";
    cta = (
      <SignInButton>
        <Button
          variant="elevated"
          className="mt-6 w-full md:w-auto rounded-full px-6 h-11 bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
        >
          Register
        </Button>
      </SignInButton>
    );
  } else if (!isOnboarded) {
    // Case 2: authed, profile not completed (no coords)
    text = "Complete your profile to better locate professionals around you:";
    cta = (
      <Button
        variant="elevated"
        asChild
        className="mt-6 w-full md:w-auto rounded-full px-6 h-11 bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
      >
        <Link href="/profile">Complete Profile</Link>
      </Button>
    );
  } else if (!hasTenant) {
    // Case 3: authed + coords, not a tenant yet
    text =
      "Have a business idea? Register yourservice to appear on this radar!";
    cta = (
      <Button
        variant="elevated"
        asChild
        className="mt-6 w-full md:w-auto rounded-full px-6 h-11 bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
      >
        <Link href="/profile?tab=vendor">Register as a provider</Link>
      </Button>
    );
  } else {
    // Case 4: already a tenant → hide CTA
    return null;
  }

  return (
    <section
      ref={hostRef}
      data-reveal={reveal ? "true" : "false"}
      className={cn("py-14 md:py-20 text-center", className)}
      aria-label="Call to action"
    >
      {/* ✅ wrap text + button so they reveal together */}
      <div className="infin-cta-reveal" style={{ "--du": "1.9s" } as VarStyle}>
        <h2
          className={cn(
            "leading-[1.08] tracking-tight",
            "text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground/90",
            line1FontClass
          )}
          style={{ "--du": "1.9s" } as VarStyle}
        >
          {text}
        </h2>
        <div className="mt-6 flex justify-center">{cta}</div>
      </div>

      {/* Co-located tiny CSS for the wipe-in effect */}
      <style jsx global>{`
        .infin-cta-reveal {
          --cpad: 2px;
          display: block;
          position: relative;
          clip-path: inset(0 100% 0 0);
          opacity: 0;
        }
        @keyframes infin-clip-wipe-cta {
          to {
            clip-path: inset(0 -8% 0 0);
            opacity: 1;
          }
        }
        [data-reveal="true"] .infin-cta-reveal {
          animation: infin-clip-wipe-cta var(--du, 1.9s) 0s linear both;
          will-change: clip-path, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-reveal="true"] .infin-cta-reveal {
            animation: none;
            clip-path: inset(0 0 0 0);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
