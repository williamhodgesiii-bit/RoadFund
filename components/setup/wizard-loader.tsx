"use client";

import dynamic from "next/dynamic";

// The wizard restores drafts from browser storage, so it renders only in the browser.
export const WizardLoader = dynamic(() => import("./wizard").then((m) => m.SetupWizard), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-paper" />,
});
