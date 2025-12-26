import { CURRENT_TERMS } from "@/modules/legal/terms-of-use";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms of Use",
};

export default function TermsPage() {
  return <CURRENT_TERMS.Component />;
}
