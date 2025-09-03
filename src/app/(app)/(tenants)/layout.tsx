// This layout adds RBC CSS for ALL tenant routes (home + dashboard).
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

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
