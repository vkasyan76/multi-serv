import {
  SUPPORT_CHAT_ACCOUNT_AWARE,
  SUPPORT_CHAT_PHASE,
} from "@/modules/support-chat/lib/boundaries";

export function SupportChatEntryPlaceholder() {
  return (
    <main className="container mx-auto px-4 py-10">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Support</h1>

        <p className="text-sm text-neutral-700">
          Get general help with registration, bookings, payments,
          cancellations, disputes, and marketplace usage.
        </p>

        <p className="text-sm text-neutral-700">
          {/* Keep the first page copy blunt so Phase 1 does not imply hidden
          personalization or account-aware powers before they exist. */}
          Phase {SUPPORT_CHAT_PHASE} provides general support guidance only. It
          does not access live order, payment, or account-specific data.
        </p>

        {!SUPPORT_CHAT_ACCOUNT_AWARE ? (
          <p className="text-sm text-neutral-700">
            Support chat is available to guests and signed-in users through the
            same entry point, but account-aware answers are a later phase.
          </p>
        ) : null}
      </div>
    </main>
  );
}
