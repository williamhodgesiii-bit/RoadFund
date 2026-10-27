import type { Metadata } from "next";
import { DemoLoader } from "@/components/demo-loader";

export const metadata: Metadata = { title: "Demo road", robots: { index: false } };

export default function DemoPage() {
  return <DemoLoader />;
}
