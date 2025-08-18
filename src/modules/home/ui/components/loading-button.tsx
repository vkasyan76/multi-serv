"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import type { VariantProps } from "class-variance-authority";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  loadingText?: string;
  /** Reserve the current label width to avoid layout shift */
  reserveWidth?: boolean;
  asChild?: boolean;
}

export function LoadingButton({
  isLoading = false,
  loadingText = "Loading…",
  reserveWidth = true,
  className,
  children,
  asChild = false,
  disabled,
  ...props
}: LoadingButtonProps) {
  // If asChild with <a>/<Link>, we must neutralize pointer/input while loading.
  const child = asChild ? React.Children.only(children) : null;
  
  // Type-safe way to check if child has href prop (for Link components)
  const isAnchorChild =
    !!child &&
    React.isValidElement(child) &&
    (child.type === "a" ||
      // Next <Link> renders an <a>, but type !== 'a', so check for href prop:
      (typeof (child.props as { href?: string })?.href !== "undefined"));

  const blockedChild =
    isAnchorChild && isLoading && child
      ? React.cloneElement(
          child as React.ReactElement<{
            className?: string
            onClick?: (e: React.MouseEvent) => void
            tabIndex?: number
            "aria-disabled"?: boolean
          }>,
          {
            // Block interactions while loading
            className: cn(
              (child.props as { className?: string }).className,
              "pointer-events-none select-none"
            ),
            "aria-disabled": true,
            tabIndex: -1,
            onClick: (e: React.MouseEvent) => e.preventDefault(),
          }
        )
      : children;

  return (
    <Button
      {...props}
      className={cn(className)}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      asChild={asChild}
      aria-label={isLoading ? "Loading" : undefined}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {/* Reserve original label width to avoid shift */}
          <span className={reserveWidth ? "inline-flex" : undefined}>
            {loadingText}
          </span>
        </span>
      ) : (
        blockedChild
      )}
    </Button>
  );
}
