import { CURRENT_POLICY } from "@/modules/legal/policy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Policy",
};

export default function PolicyPage() {
  return <CURRENT_POLICY.Component />;
}
