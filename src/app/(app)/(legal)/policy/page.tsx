import { PolicyV1 } from "@/modules/legal/policy/policy-v1";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Policy",
};

export default function PolicyPage() {
  return <PolicyV1 />;
}
