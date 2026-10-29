"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Mail } from "lucide-react";
import { finishSignIn, getStatus, requestSignIn, type Status } from "@/lib/client/backend";
import { listRoads, setActiveId } from "@/lib/client/registry";
import { useHash } from "@/lib/client/use-browser";
import { Button, ButtonLink, Callout, Field, Input } from "./ui";

// Roads this browser already has, as a JSON string so the snapshot compares by value.
const subscribeRoads = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function SignInForm() {
  const router = useRouter();
  const saved = useSyncExternalStore(
    subscribeRoads,
    () => JSON.stringify(listRoads().filter((r) => !r.demo).map((r) => ({ id: r.id, name: r.name }))),
    () => "[]",
  );
  const here = JSON.parse(saved) as { id: string; name: string }[];
  const onDevice = here.length > 0 && (
    <div className="mb-8 rounded-lg border-2 border-pine/40 bg-white p-5">
      <p className="font-bold">{here.length === 1 ? "Your road is" : "Your roads are"} already on this device</p>
      <div className="mt-3 grid gap-2">
        {here.map((r) => (
          <Button
            key={r.id}
            block
            onClick={() => {
              setActiveId(r.id);
              window.dispatchEvent(new Event("rf:switch-road"));
              router.push("/app");
            }}
          >
            Open {r.name}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-[0.95rem] text-stone">Signing in on a different phone or computer? Use your email below.</p>
    </div>
  );
  const token = new URLSearchParams(useHash()).get("t");
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  // Opened from the email: trade the one-time link for this device's captain key.
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", "/signin");
    finishSignIn(token).then(
      () => {
        window.dispatchEvent(new Event("rf:switch-road"));
        router.replace("/app");
      },
      (e) => setError(e instanceof Error ? e.message : "That link didn't work. Ask for a new one."),
    );
  }, [token, router]);

  if (token && !error) {
    return (
      <p className="flex items-center gap-2 text-stone">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Signing you in…
      </p>
    );
  }

  if (sentTo) {
    return (
      <Callout tone="ok" title="Check your email">
        <p>
          If {sentTo} is the captain email for a road, a sign-in link is on its way. It works once, for 20 minutes. Open it on the phone or computer you want to use.
        </p>
        <p className="mt-2">Nothing after a few minutes? Check spam, or make sure it&apos;s the email listed for your home on the road.</p>
      </Callout>
    );
  }

  if (status && !(status.cloud && status.email)) {
    return (
      <>
        {onDevice}
        <Callout tone="info" title="Email sign-in isn't turned on here">
          <p>Open the captain link you copied from Settings on the device where you set up the road. It opens the road on any phone or computer.</p>
          <div className="mt-3">
            <ButtonLink href="/app" variant="secondary">
              Go to my roads
            </ButtonLink>
          </div>
        </Callout>
      </>
    );
  }

  return (
    <>
      {onDevice}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSending(true);
          try {
            await requestSignIn(email.trim());
            setSentTo(email.trim());
          } catch (err) {
            setError(err instanceof Error ? err.message : "That didn't go through. Try again.");
          }
          setSending(false);
        }}
      >
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Your email" htmlFor="signin-email" hint="The email listed for your home on the road.">
          <Input id="signin-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" block loading={sending} icon={<Mail className="h-5 w-5" aria-hidden />}>
          Email me a sign-in link
        </Button>
        <p className="text-[0.95rem] text-stone">Neighbors don&apos;t sign in. Your page opens from the link your road captain sent you.</p>
      </form>
    </>
  );
}
