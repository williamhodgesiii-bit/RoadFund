// Who runs Road Fund, shown on the About page, the footer and the header.
// Set these in the deployment's environment. Anything left blank is left off the
// site rather than filled with a placeholder.

const env = (v: string | undefined) => (v ?? "").trim();

export const COMPANY = {
  /** Legal name, e.g. "Road Fund LLC". */
  legalName: env(process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME),
  /** Town and state, e.g. "Traverse City, Michigan". */
  town: env(process.env.NEXT_PUBLIC_COMPANY_TOWN),
  /** Mailing address on one line. */
  address: env(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
  phone: env(process.env.NEXT_PUBLIC_SUPPORT_PHONE),
  /** When the phone is answered, e.g. "Weekdays 9 to 5 Eastern". */
  hours: env(process.env.NEXT_PUBLIC_SUPPORT_HOURS),
  email: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  founder: env(process.env.NEXT_PUBLIC_FOUNDER_NAME),
  /** A few sentences in the founder's own words: who they are and why they built it. */
  founderNote: env(process.env.NEXT_PUBLIC_FOUNDER_NOTE),
  /** Path under /public, e.g. "/about/founder.jpg". */
  founderPhoto: env(process.env.NEXT_PUBLIC_FOUNDER_PHOTO),
};

/** "(231) 555-0142" from any US number; anything else is returned as typed. */
export function phoneText(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

export function telHref(phone: string): string {
  const d = phone.replace(/[^\d+]/g, "");
  return `tel:${d.startsWith("+") ? d : `+1${d.replace(/^1(?=\d{10}$)/, "")}`}`;
}
