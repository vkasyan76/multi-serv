import BridgeAuthMount from "./BridgeAuthMount";

export default function TenantsSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BridgeAuthMount />
      {children}
    </>
  );
}
