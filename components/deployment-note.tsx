"use client";

import { useEffect, useState } from "react";
import { getStatus, type Status } from "@/lib/client/backend";

type Variant = "footer" | "faq" | "pricing" | "legal";

const TEXT: Record<Variant, Record<"sim" | "test", string>> = {
  footer: {
    sim: "Test deployment: payments and bank connections are simulated. No real money moves.",
    test: "Payments run in Stripe test mode. No real money moves.",
  },
  faq: {
    sim: "In this test deployment, bank connections and payments are simulated.",
    test: "This site runs Stripe in test mode, so no real money moves yet.",
  },
  pricing: {
    sim: "Test deployment: plan upgrades and purchases are simulated, and you can switch plans freely from Settings.",
    test: "Stripe test mode: checkout takes the test card 4242 4242 4242 4242 and nothing is charged.",
  },
  legal: {
    sim: "Payments, bank connections and plan purchases are simulated on this site. No money moves.",
    test: "Payments run in Stripe test mode. Checkout and bank connections work end to end, but no real money moves.",
  },
};

/** One line saying what's real on this deployment. Says nothing once payments are live. */
export function DeploymentNote({ variant, className }: { variant: Variant; className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    getStatus().then(setStatus);
  }, []);
  if (!status || status.stripe === "live") return null;
  const text = TEXT[variant][status.stripe === "test" ? "test" : "sim"];
  const messaging =
    variant === "legal" && !(status.email || status.sms) ? " Road Fund doesn't send texts or emails here: the Text and Email buttons open your own phone's apps." : "";
  return (
    <p className={className}>
      {variant === "faq" ? " " : ""}
      {text}
      {messaging}
    </p>
  );
}
