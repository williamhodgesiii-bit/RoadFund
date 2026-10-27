import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.TWILIO_AUTH_TOKEN = "12345";
const { e164, textToHtml, validEmail, validTwilioSignature } = await import("./notify.ts");

test("e164 accepts US numbers in the ways people type them", () => {
  assert.equal(e164("(231) 555-0142"), "+12315550142");
  assert.equal(e164("231.555.0142"), "+12315550142");
  assert.equal(e164("1-231-555-0142"), "+12315550142");
  assert.equal(e164("+1 231 555 0142"), "+12315550142");
  assert.equal(e164("555-0142"), null);
  assert.equal(e164("(131) 555-0142"), null, "area codes never start with 1");
  assert.equal(e164(""), null);
});

test("validEmail", () => {
  assert.ok(validEmail("carol@example.com"));
  assert.ok(!validEmail("carol@example"));
  assert.ok(!validEmail("carol example.com"));
  assert.ok(!validEmail(null));
});

test("Twilio signatures: HMAC-SHA1 over URL plus sorted params", async () => {
  const url = "https://roadfund.example/api/sms/inbound";
  const params = new URLSearchParams({ To: "+15005550006", From: "+12315550110", Body: "STOP", MessageSid: "SM1" });
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  const good = createHmac("sha1", "12345").update(data).digest("base64");
  assert.ok(await validTwilioSignature(url, params, good));
  assert.ok(!(await validTwilioSignature(url, params, good.replace(/.$/, good.endsWith("A") ? "B" : "A"))));
  assert.ok(!(await validTwilioSignature(url + "?x=1", params, good)), "a different URL fails");
  assert.ok(!(await validTwilioSignature(url, params, null)));
});

test("emails: plain text becomes escaped HTML with real links", () => {
  const html = textToHtml("Pay <here>: https://roadfund.example/n/road_x/tok\n\nThanks & bye");
  assert.ok(html.includes("Pay &lt;here&gt;:"));
  assert.ok(html.includes('<a href="https://roadfund.example/n/road_x/tok"'));
  assert.ok(html.includes("Thanks &amp; bye"));
  assert.ok(!html.includes("<here>"));
});
