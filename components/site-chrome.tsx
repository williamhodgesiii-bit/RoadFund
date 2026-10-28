"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DeploymentNote } from "./deployment-note";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { ButtonLink, cx } from "./ui";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/calculator", label: "Calculator" },
  { href: "/guide", label: "Road law" },
  { href: "/closing", label: "Selling a home" },
  { href: "/help", label: "Help" },
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
        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "whitespace-nowrap rounded-lg px-3 py-2 text-[1rem] font-semibold hover:bg-paper-2",
                path === n.href ? "text-pine" : "text-charcoal",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <ButtonLink href="/demo" variant="ghost" size="sm" className="whitespace-nowrap">
            Sample road
          </ButtonLink>
          <ButtonLink href="/app" variant="primary" size="sm" className="whitespace-nowrap">
            Open my road
          </ButtonLink>
        </div>
        <button className="flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold xl:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
          {open ? <X className="h-7 w-7" aria-hidden /> : <Menu className="h-7 w-7" aria-hidden />}
          <span>Menu</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-paper px-4 pb-5 pt-2 xl:hidden">
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
              See a sample road
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
        <FooterCol title="Road Fund" links={[["/#how", "How it works"], ["/pricing", "Pricing"], ["/demo", "Sample road"], ["/start", "Set up your road"], ["/signin", "Captain sign-in"], ["/help", "Help"]]} />
        <FooterCol title="Free tools" links={[["/calculator", "Share calculator"], ["/guide", "Road law guide"], ["/verify", "Check a letter"]]} />
        <FooterCol title="Partners" links={[["/closing", "Title companies and agents"], ["/closing#request", "Request a letter"], ["/contractors", "Plow and grading contractors"], ["/legal", "Terms and privacy"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-[0.88rem] text-stone">
          <p>
            Road Fund is not a law firm and does not give legal advice. Agreement drafts are for review by a licensed attorney in your state.
          </p>
          <DeploymentNote variant="footer" />
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
