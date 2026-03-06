"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import type { AppLang } from "@/lib/i18n/app-lang";
import type { ReactNode } from "react";

type IntlProviderProps = {
  locale: AppLang;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      // Phase 3: keep missing-message visibility in dev without breaking runtime.
      onError={(error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[i18n] message error:", error);
        }
      }}
      getMessageFallback={({ namespace, key }) =>
        namespace ? `${namespace}.${key}` : key
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}
