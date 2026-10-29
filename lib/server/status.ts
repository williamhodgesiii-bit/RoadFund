import { aiEnabled } from "./ai.ts";
import { kvEnabled } from "./kv.ts";
import { emailEnabled, smsEnabled } from "./notify.ts";
import { stripeEnabled, stripeMode } from "./stripe.ts";

/** What this deployment has turned on. The browser adapts its screens to it. */
export function deploymentStatus() {
  return { cloud: kvEnabled, ai: aiEnabled, stripe: stripeEnabled ? stripeMode : null, email: emailEnabled, sms: smsEnabled };
}
