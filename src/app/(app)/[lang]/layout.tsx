import { notFound } from "next/navigation";
import { isLocaleSegment } from "@/i18n/routing";

export default async function LocaleSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // Guard locale segment early so only canonical app languages render.
  if (!isLocaleSegment(lang.toLowerCase())) {
    notFound();
  }

  return children;
}

