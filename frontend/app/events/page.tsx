import type { Metadata } from "next";
import EventsClient from "./EventsClient";

export const metadata: Metadata = {
  title: "Events | BeaconPay",
  description:
    "Discover upcoming community events, member meetups, and workspace sessions at BeaconPay. RSVP and join the community.",
  openGraph: {
    title: "Events | BeaconPay",
    description:
      "Discover upcoming community events, member meetups, and workspace sessions at BeaconPay.",
    type: "website",
  },
};

export default function EventsPage() {
  return <EventsClient />;
}
