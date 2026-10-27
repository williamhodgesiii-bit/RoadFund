"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { ButtonLink, cx } from "./ui";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/calculator", label: "Share calculator" },
  { href: "/pricing", label: "Pricing" },
  { href: "/closing", label: "For closings" },
  { href: "/guide", label: "Road law guide" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Road Fund home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "rounded-lg px-3 py-2 text-[0.95rem] font-semibold hover:bg-paper-2",
                path === n.href ? "text-pine" : "text-charcoal",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink href="/demo" variant="ghost" size="sm">
            Try the demo
          </ButtonLink>
          <ButtonLink href="/app" variant="primary" size="sm">
            Open my road
          </ButtonLink>
        </div>
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
          {open ? <X className="h-7 w-7" aria-hidden /> : <Menu className="h-7 w-7" aria-hidden />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-paper px-4 pb-5 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-lg px-2 py-3 text-[1.05rem] font-semibold hover:bg-paper-2">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            <ButtonLink href="/start" block>
              Set up your road
            </ButtonLink>
            <ButtonLink href="/demo" variant="secondary" block>
              Try the demo road
            </ButtonLink>
            <ButtonLink href="/app" variant="ghost" block>
              Open my road
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-paper-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-stone">Dues, records and closing letters for private roads. Built for the neighbor who keeps the road running.</p>
        </div>
        <FooterCol title="Road Fund" links={[["/#how", "How it works"], ["/pricing", "Pricing"], ["/demo", "Demo road"], ["/start", "Set up your road"]]} />
        <FooterCol title="Free tools" links={[["/calculator", "Share calculator"], ["/guide", "Road law guide"], ["/verify", "Verify a letter"]]} />
        <FooterCol title="Closings" links={[["/closing", "Title and lenders"], ["/closing#request", "Request a letter"], ["/legal", "Terms and privacy"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-[0.88rem] text-stone">
          <p>
            Road Fund is not a law firm and does not give legal advice. Agreement drafts are for review by a licensed attorney in your state.
          </p>
          <p>Test deployment: payments, bank connections, texts and notary steps are simulated. No real money moves.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-bold">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-stone hover:text-pine hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
