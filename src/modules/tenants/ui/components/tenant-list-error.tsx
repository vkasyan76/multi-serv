"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export const TenantListError = () => {
  const router = useRouter();
  const tMarketplace = useTranslations("marketplace");

  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {tMarketplace("error.title")}
      </h3>
      <p className="text-gray-600 mb-4">
        {tMarketplace("error.body")}
      </p>
      <button
        onClick={() => router.refresh()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        aria-label={tMarketplace("error.refresh_aria")}
      >
        {/* Step 9 keeps retry behavior intact and only localizes the error UI. */}
        {tMarketplace("error.refresh")}
      </button>
    </div>
  );
};
