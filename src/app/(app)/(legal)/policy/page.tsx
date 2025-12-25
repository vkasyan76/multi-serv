import { CURRENT_POLICY } from "@/modules/legal/policy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Policy",
};

export default function PolicyPage() {
  const PolicyComponent = CURRENT_POLICY.Component;
  return <PolicyComponent />;
}
