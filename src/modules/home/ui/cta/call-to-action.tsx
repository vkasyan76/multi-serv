"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
};

// CSS var typing for style prop
type VarStyle = React.CSSProperties & { ["--du"]?: string };

export default function CallToAction({
  isAuthed,
  isOnboarded,
  hasTenant,
  loading,
  className,
  line1FontClass,
}: Props) {
  // Hooks FIRST (fixes rules-of-hooks warning)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    // 1) If already on screen at mount (common after refresh), reveal immediately.
    const alreadyInView =
      el.getBoundingClientRect().top < window.innerHeight * 0.95;
    if (alreadyInView) setReveal(true);

    // 2) Keep an observer for normal scroll-in cases.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReveal(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  //   previous use effect
  //   useEffect(() => {
  //     const el = hostRef.current;
  //     if (!el) return;
  //     const io = new IntersectionObserver(
  //       ([entry]) => {
  //         if (entry?.isIntersecting) {
  //           setReveal(true);
  //           io.disconnect();
  //         }
  //       },
  //       { rootMargin: "0px 0px 5% 0px", threshold: 0 }
  //     );
  //     io.observe(el);
  //     return () => io.disconnect();
  //   }, []);

  // If still loading auth/profile, don’t render CTA
  if (loading) return null;

  // Decide which variant to show
  let text: string | null = null;
  let cta: ReactNode = null;

  if (!isAuthed) {
    // Case 1: guest
    text = "Register for free to connect to these professionals.";
    cta = (
      <SignInButton>
        <Button className="mt-6 w-full md:w-auto rounded-full px-6 h-11 bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg">
          Register
        </Button>
      </SignInButton>
    );
  } else if (!isOnboarded) {
    // Case 2: authed, profile not completed (no coords)
    text = "Complete your profile to better locate professionals around you!";
    cta = (
      <Button
        asChild
        className="mt-6 w-full md:w-auto rounded-full px-6 h-11 bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
      >
        <Link href="/profile">Complete Profile</Link>
      </Button>
    );
  } else if (!hasTenant) {
    // Case 3: authed + coords, not a tenant yet
    text =
      "Have a business idea? Register as a service provider to appear on this radar!";
    cta = (
      <Button
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
      <h2
        className={cn(
          "infin-cta-reveal leading-[1.08] tracking-tight",
          "text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground/90",
          line1FontClass
        )}
        style={{ "--du": "1.9s" } as VarStyle}
      >
        {text}
      </h2>
      {cta}

      {/* Co-located tiny CSS for the wipe-in effect */}
      <style jsx global>{`
        .infin-cta-reveal {
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
