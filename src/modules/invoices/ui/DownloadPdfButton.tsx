"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type AppLang } from "@/lib/i18n/app-lang";

export function DownloadPdfButton({
  invoiceId,
  appLang,
}: {
  invoiceId: string;
  appLang: AppLang;
}) {
  const tFinance = useTranslations("finance");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!invoiceId || isDownloading) return;
    setIsDownloading(true);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf?lang=${appLang}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`PDF download failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(tFinance("pdf.errors.download_failed"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading
        ? tFinance("pdf.actions.downloading")
        : tFinance("pdf.actions.download")}
    </Button>
  );
}
