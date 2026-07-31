import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "Learn how BeaconPay collects, uses, and protects your personal data. Your privacy matters to us.",
  keywords: ["privacy policy", "data protection", "BeaconPay", "privacy"],
});

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
