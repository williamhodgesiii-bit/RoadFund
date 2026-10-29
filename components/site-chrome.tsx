"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { COMPANY, phoneText, telHref } from "@/lib/company";
import { DeploymentNote } from "./deployment-note";
import { Logo } from "./logo";
import { ButtonLink, cx } from "./ui";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/closing", label: "Selling a home" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
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
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Road Fund home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path === n.href ? "page" : undefined}
              className={cx("whitespace-nowrap rounded-lg px-3 py-2 text-[1rem] font-semibold hover:bg-paper-2", path === n.href ? "text-pine underline underline-offset-4" : "text-charcoal")}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {COMPANY.phone && (
            <a href={telHref(COMPANY.phone)} className="tnum mr-1 inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-charcoal hover:text-pine">
              <Phone className="h-4 w-4" aria-hidden /> {phoneText(COMPANY.phone)}
            </a>
          )}
          <Link href="/signin" className="whitespace-nowrap rounded-lg px-3 py-2 font-semibold text-pine hover:bg-paper-2">
            Sign in
          </Link>
          <ButtonLink href="/start" size="sm" className="whitespace-nowrap">
            Set up your road
          </ButtonLink>
        </div>
        <button className="flex min-h-12 items-center gap-2 rounded-lg px-2 font-semibold xl:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav">
          {open ? <X className="h-7 w-7" aria-hidden /> : <Menu className="h-7 w-7" aria-hidden />}
          <span>Menu</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-paper px-4 pb-5 pt-2 xl:hidden">
          <ul className="flex flex-col divide-y divide-line">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block px-1 py-3.5 text-[1.1rem] font-semibold">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/signin" className="block px-1 py-3.5 text-[1.1rem] font-semibold">
                Road captain sign in
              </Link>
            </li>
          </ul>
          <div className="mt-3 grid gap-2">
            <ButtonLink href="/start" block>
              Set up your road
            </ButtonLink>
            <ButtonLink href="/demo" variant="secondary" block>
              See a sample road
            </ButtonLink>
          </div>
          {COMPANY.phone && (
            <p className="mt-4">
              Questions? Call{" "}
              <a href={telHref(COMPANY.phone)} className="tnum font-semibold text-lake underline">
                {phoneText(COMPANY.phone)}
              </a>
              {COMPANY.hours && <span className="text-stone"> ({COMPANY.hours})</span>}
            </p>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const contact = [COMPANY.legalName, COMPANY.address || COMPANY.town].filter(Boolean);
  return (
    <footer className="mt-20 border-t border-line bg-paper-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm">Road Fund keeps the books for private roads: the yearly bill, who paid, votes on road work, the road agreement, and letters for home sales.</p>
          {(contact.length > 0 || COMPANY.phone || COMPANY.email) && (
            <address className="mt-4 space-y-1 not-italic">
              {contact.map((c) => (
                <p key={c}>{c}</p>
              ))}
              {COMPANY.phone && (
                <p>
                  <a href={telHref(COMPANY.phone)} className="tnum font-semibold text-lake underline">
                    {phoneText(COMPANY.phone)}
                  </a>
                  {COMPANY.hours && <span className="text-stone"> · {COMPANY.hours}</span>}
                </p>
              )}
              {COMPANY.email && (
                <p>
                  <a href={`mailto:${COMPANY.email}`} className="font-semibold text-lake underline">
                    {COMPANY.email}
                  </a>
                </p>
              )}
            </address>
          )}
        </div>
        <FooterCol title="Road Fund" links={[["/#how", "How it works"], ["/pricing", "Pricing"], ["/demo", "Sample road"], ["/start", "Set up your road"], ["/signin", "Captain sign in"], ["/about", "About"]]} />
        <FooterCol title="For your road" links={[["/calculator", "Share calculator"], ["/guide", "Road law by state"], ["/help", "Help"], ["/contractors", "For plow and grading contractors"]]} />
        <FooterCol title="Selling a home" links={[["/closing", "Title companies and agents"], ["/closing#request", "Request a letter"], ["/verify", "Check a letter"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-[0.95rem] text-stone">
          <p>
            © {new Date().getFullYear()} {COMPANY.legalName || "Road Fund"} ·{" "}
            <Link href="/legal" className="underline hover:text-pine">
              Terms and privacy
            </Link>
          </p>
          <p>Road Fund is not a law firm and does not give legal advice. Agreement drafts are for review by a licensed attorney in your state.</p>
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
      <ul className="mt-3 space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-charcoal underline decoration-line underline-offset-4 hover:text-pine hover:decoration-pine">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
