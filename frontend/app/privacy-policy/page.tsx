import type { Metadata } from "next";
import PrivacyPolicyClient from "./PrivacyPolicyClient";

export const metadata: Metadata = {
  title: "Privacy Policy | BeaconPay",
  description:
    "Learn how BeaconPay collects, uses, and protects your personal information. Our privacy policy explains your rights and our data practices in plain English.",
  openGraph: {
    title: "Privacy Policy | BeaconPay",
    description:
      "Learn how BeaconPay collects, uses, and protects your personal information.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />;
}
