"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CustomerOrdersLifecycleView } from "@/modules/orders/ui/customer-orders-lifecycle-view";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { withLocalePrefix } from "@/i18n/routing";
import { toast } from "sonner";

export function CustomerSlotOrdersView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const tOrders = useTranslations("orders");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);

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
          router.replace(withLocalePrefix("/orders", appLang));
        },
        onError: () => {
          // allow retry on next render if needed
          finalizeOnceRef.current = false;
          toast.error(tOrders("toasts.invoice_finalize_failed"));
        },
      },
    );
  }, [
    invoiceSuccess,
    sessionId,
    finalizeInvoice,
    qc,
    router,
    appLang,
    tOrders,
    trpc.orders,
    trpc.invoices,
  ]);

  return (
    <div className="bg-white">
      {/* The shared site navbar now comes from the route-group layout; keep
      the orders view focused on its task header and content. */}
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 flex flex-col gap-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-[32px] font-medium">
              {tOrders("page.title")}
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label={tOrders("page.flow_info_label")}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {tOrders("page.flow_info_tooltip")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <CustomerOrdersLifecycleView appLang={appLang} />
      </section>
    </div>
  );
}
