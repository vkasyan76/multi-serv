"use client";

import { usePathname } from "next/navigation";
import BridgeAuth from "@/modules/tenants/ui/components/tenant_page/BridgeAuth";

export default function BridgeAuthMount() {
  const pathname = usePathname();

  // Dashboard is platform-internal; do not run bridge there.
  if (pathname.includes("/dashboard")) return null;

  return <BridgeAuth />;
}
