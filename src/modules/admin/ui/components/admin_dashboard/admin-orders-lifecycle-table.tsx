"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type OrdersLifecycleAdminRow,
  EM_DASH,
  PaymentStatusBadge,
  StatusBadge,
  formatDateTime,
  getCustomerLabel,
  getDateRange,
  getTenantLabel,
} from "@/modules/orders/ui/orders-lifecycle-shared";

type Props = {
  orders: OrdersLifecycleAdminRow[];
  locale: string;
};

export function AdminOrdersLifecycleTable({ orders, locale }: Props) {
  // Admin orders stays read-only here: expansion only, no actions or mutation hooks.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-lg border bg-background">
      <table className="w-full caption-bottom text-sm table-fixed">
        <colgroup>
          <col className="w-11" />
          <col className="w-[180px]" />
          <col className="w-[180px]" />
          <col className="w-[360px]" />
          <col className="w-[140px]" />
          <col className="w-[140px]" />
        </colgroup>
        <TableHeader className="border-b">
          <TableRow>
            <TableHead className="sticky top-0 z-20 bg-background w-11" />
            <TableHead className="sticky top-0 z-20 bg-background">
              Tenant
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              Customer
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              Date range
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              Status
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-background">
              Payment
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {orders.map((o) => {
            const isOpen = !!open[o.id];
            const range = getDateRange(o.slots ?? [], locale);

            return (
              <Fragment key={o.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggle(o.id)}
                      aria-label={isOpen ? "Collapse order" : "Expand order"}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>

                  <TableCell className="font-medium">
                    {getTenantLabel(o)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getCustomerLabel(o)}
                  </TableCell>
                  <TableCell className="pr-6">{range}</TableCell>
                  <TableCell>
                    <StatusBadge value={o.serviceStatus} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge value={o.invoiceStatus} />
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="py-2">
                        <table className="w-full caption-bottom text-sm table-fixed">
                          <colgroup>
                            <col className="w-11" />
                            <col className="w-[180px]" />
                            <col className="w-[180px]" />
                            <col className="w-[360px]" />
                            <col className="w-[140px]" />
                            <col className="w-[140px]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead aria-hidden="true" />
                              <TableHead>Date/time</TableHead>
                              <TableHead>Service</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead aria-hidden="true" />
                              <TableHead aria-hidden="true" />
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {(o.slots ?? []).map((s) => (
                              <TableRow key={s.id}>
                                <TableCell aria-hidden="true" />
                                <TableCell>
                                  {formatDateTime(s.start, locale)}
                                </TableCell>
                                <TableCell>
                                  {s.serviceSnapshot?.serviceName ?? EM_DASH}
                                </TableCell>
                                <TableCell>
                                  <div className="h-10 flex items-center">
                                    <StatusBadge value={s.serviceStatus} />
                                  </div>
                                  {s.serviceStatus === "disputed" &&
                                  s.disputeReason ? (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {s.disputeReason}
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell aria-hidden="true" />
                                <TableCell aria-hidden="true" />
                              </TableRow>
                            ))}
                          </TableBody>
                        </table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </table>
    </div>
  );
}
