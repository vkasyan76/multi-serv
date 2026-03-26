import { CURRENT_TERMS } from "@/modules/legal/terms-of-use";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("legalTerms");
  return {
    title: t("meta.title"),
  };
}

export default function TermsPage() {
  return <CURRENT_TERMS.Component />;
}
