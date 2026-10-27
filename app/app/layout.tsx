import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";

export const metadata: Metadata = { title: { default: "Your road", template: "%s · Road Fund" }, robots: { index: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
