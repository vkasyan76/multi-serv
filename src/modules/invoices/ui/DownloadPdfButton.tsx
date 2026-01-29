"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!invoiceId || isDownloading) return;
    setIsDownloading(true);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
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
      toast.error("Failed to download PDF. Please try again.");
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
      {isDownloading ? "Downloading..." : "Download PDF"}
    </Button>
  );
}
