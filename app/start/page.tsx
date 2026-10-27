import type { Metadata } from "next";
import { WizardLoader } from "@/components/setup/wizard-loader";

export const metadata: Metadata = { title: "Set up your road", robots: { index: false } };

export default function StartPage() {
  return <WizardLoader />;
}
