"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CustomerOrdersLifecycleView } from "@/modules/orders/ui/customer-orders-lifecycle-view";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AppLang,
  getInitialLanguage,
  normalizeToSupported,
} from "@/modules/profile/location-utils";

export function CustomerSlotOrdersView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const profileQ = useQuery(trpc.auth.getUserProfile.queryOptions());
  const appLang: AppLang = useMemo(() => {
    const profileLang = profileQ.data?.language;
    if (profileLang) return normalizeToSupported(profileLang);
    return getInitialLanguage();
  }, [profileQ.data?.language]);

  const router = useRouter();
  const search = useSearchParams();
  const invoiceSuccess = search.get("invoice") === "success";
  const sessionId = search.get("session_id") || "";

  const finalizeInvoice = useMutation({
    ...trpc.invoices.finalizeFromSession.mutationOptions(),
  });

  const finalizeOnceRef = useRef(false);

  useEffect(() => {
    if (!invoiceSuccess || !sessionId || finalizeOnceRef.current) return;
    finalizeOnceRef.current = true;

    finalizeInvoice.mutate(
      { sessionId },
      {
        onSuccess: async () => {
          await qc.invalidateQueries({
            queryKey: trpc.orders.listMineSlotLifecycle.queryKey(),
          });
          await qc.invalidateQueries({
            queryKey: trpc.invoices.getForOrder.queryKey(),
          });
          router.replace("/orders");
        },
        onError: () => {
          // allow retry on next render if needed
          finalizeOnceRef.current = false;
        },
      },
    );
  }, [
    invoiceSuccess,
    sessionId,
    finalizeInvoice,
    qc,
    router,
    trpc.orders,
    trpc.invoices,
  ]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <nav className="bg-white w-full border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 h-14 sm:h-16 flex items-center justify-end gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Home"
                >
                  <Home className="h-7 w-7" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 flex flex-col gap-y-2">
          <h1 className="text-[32px] font-medium">My Orders</h1>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <CustomerOrdersLifecycleView appLang={appLang} />
      </section>
    </div>
  );
}
