import TenantCalendar from "@/modules/bookings/ui/TenantCalender";

interface Props {
  params: { slug: string };
}

export default function TenantDashboard({ params }: Props) {
  const { slug } = params;
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard — {slug}</h1>
      <TenantCalendar tenantSlug={slug} />
    </div>
  );
}
