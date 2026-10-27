import { aiEnabled } from "@/lib/server/ai";
import { json } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { emailEnabled, smsEnabled } from "@/lib/server/notify";
import { stripeEnabled, stripeMode } from "@/lib/server/stripe";

/** What this deployment has turned on. The browser adapts its screens to it. */
export async function GET() {
  return json({ cloud: kvEnabled, ai: aiEnabled, stripe: stripeEnabled ? stripeMode : null, email: emailEnabled, sms: smsEnabled });
}
