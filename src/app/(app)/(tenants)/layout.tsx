// This layout adds RBC CSS for ALL tenant routes (home + dashboard).
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

export default function TenantsSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children; // no visual wrapper changes
}
