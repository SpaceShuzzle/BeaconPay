import type { Metadata } from "next";
import TourClient from "./TourClient";

export const metadata: Metadata = {
  title: "Book a Tour | BeaconPay",
  description:
    "Schedule a tour of BeaconPay's modern workspace facilities. See our spaces, amenities, and meet the community before you join.",
  openGraph: {
    title: "Book a Tour | BeaconPay",
    description:
      "Schedule a tour of BeaconPay's modern workspace facilities. See our spaces and amenities.",
    type: "website",
  },
};

export default function TourPage() {
  return <TourClient />;
}
