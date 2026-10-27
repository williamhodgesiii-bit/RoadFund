import { e164, setStopped, smsEnabled, validTwilioSignature } from "@/lib/server/notify";

// Twilio calls this for every text sent to the road's number. Set it as the
// "A message comes in" webhook on the number or messaging service.

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START = new Set(["START", "UNSTOP", "YES", "OPTIN"]);
const HELP = new Set(["HELP", "INFO"]);

function twiml(message?: string): Response {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${esc(message)}</Message>` : ""}</Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: Request) {
  if (!smsEnabled) return new Response("Texting isn't set up.", { status: 501 });
  const params = new URLSearchParams(await req.text());
  // Behind Vercel's proxy the public URL is what Twilio signed.
  const url = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/sms/inbound` : req.url;
  if (!(await validTwilioSignature(url, params, req.headers.get("x-twilio-signature")))) return new Response("Bad signature", { status: 403 });

  const from = e164(params.get("From"));
  const word = (params.get("Body") ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!from) return twiml();
  if (STOP.has(word)) {
    await setStopped(from, true);
    // Twilio's own opt-out handling already replies to STOP, so we stay quiet.
    return twiml();
  }
  if (START.has(word)) {
    await setStopped(from, false);
    return twiml();
  }
  if (HELP.has(word)) return twiml();
  return twiml("Road Fund sends notices for your private road. To reach your road captain, use the contact on your road page. Reply STOP to stop texts.");
}
