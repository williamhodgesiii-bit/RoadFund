// The whole road lives in one document. Roads are small (3–30 homes), so one
// JSON object per road keeps sync, export and audit simple.
// All money is integer cents. Dates are "YYYY-MM-DD"; timestamps are ISO strings.

export type ISODate = string;
export type ISOTime = string;

export type Plan = "starter" | "roadfund";
export type Surface = "gravel" | "paved" | "chip-seal" | "dirt";
export type SplitMethod = "equal" | "frontage" | "distance" | "segment" | "custom";
export type PayMethod = "ach" | "card" | "check" | "cash";
export type Channel = "text" | "email" | "print" | "link";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Home {
  id: string;
  label: string;
  address: string;
  owners: string;
  phone: string;
  email: string;
  smsOptIn: boolean;
  smsOptInAt: ISOTime | null;
  emailOptIn: boolean;
  frontageFt: number | null;
  distanceFt: number | null;
  customPct: number | null;
  vacant: boolean;
  position: LatLng | null;
  token: string;
  notes: string;
  joinedAt: ISOTime;
}

export interface SplitSettings {
  method: SplitMethod;
  /** Share weight for vacant lots. 1 = full share, 0.5 = half share. */
  vacantWeight: number;
  /**
   * Percent of the total split evenly before the method applies (0–100).
   * Used with frontage, distance and by-use splits: a base share plus a use share.
   */
  basePct: number;
}

export type ExpenseCategory =
  | "plowing"
  | "grading"
  | "gravel"
  | "culverts"
  | "ditches"
  | "trees"
  | "paving"
  | "insurance"
  | "legal"
  | "reserve"
  | "other";

export interface BudgetLine {
  id: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
}

export interface DuesLine {
  homeId: string;
  amount: number;
  reason: string;
}

export interface DuesRequest {
  id: string;
  title: string;
  kind: "annual" | "special";
  createdAt: ISOTime;
  dueDate: ISODate;
  total: number;
  budget: BudgetLine[];
  split: SplitSettings;
  lines: DuesLine[];
  message: string;
  status: "open" | "closed";
  sentAt: ISOTime | null;
  /** A project bill approved by this vote: neighbors pay before the work starts. */
  voteId?: string | null;
}

export interface Payment {
  id: string;
  requestId: string | null;
  homeId: string;
  /** Amount credited against the home's share. */
  amount: number;
  platformFee: number;
  processingFee: number;
  /** What the payer was charged in total. */
  charged: number;
  /** What lands in the road account. */
  roadNet: number;
  method: PayMethod;
  paidAt: ISOTime;
  clearsAt: ISOTime;
  status: "ok" | "void";
  voidReason?: string;
  receiptNo: string;
  payerName: string;
  note: string;
  recordedBy: "neighbor" | "captain";
  /** Stripe Checkout session that produced this payment, when paid through Stripe. */
  stripeSessionId?: string;
}

export interface Expense {
  id: string;
  contractorId: string | null;
  vendorName: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  invoiceDate: ISODate;
  createdAt: ISOTime;
  status: "awaiting-approval" | "approved" | "paid" | "rejected";
  approvedAt: ISOTime | null;
  paidAt: ISOTime | null;
  paidVia: "road-account" | "check" | "reimbursed" | null;
  invoiceFileId: string | null;
  workEntryId: string | null;
}

export interface Contractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  notes: string;
}

export interface PhotoRef {
  fileId: string;
  tag: "before" | "after" | "damage" | "receipt" | "other";
}

export interface WorkEntry {
  id: string;
  kind: "work" | "damage";
  date: ISODate;
  title: string;
  description: string;
  contractorId: string | null;
  cost: number | null;
  photos: PhotoRef[];
  status: "open" | "scheduled" | "fixed" | null;
  createdAt: ISOTime;
}

export type VoteKind = "repair" | "improvement" | "agreement" | "other";
export type Threshold = "majority" | "two-thirds" | "unanimous";

export interface Ballot {
  homeId: string;
  choice: "yes" | "no" | "abstain";
  at: ISOTime;
  via: "link" | "phone" | "in-person" | "email";
}

export interface Vote {
  id: string;
  kind: VoteKind;
  question: string;
  detail: string;
  amount: number | null;
  createdAt: ISOTime;
  deadline: ISODate;
  threshold: Threshold;
  ballots: Ballot[];
  closedAt: ISOTime | null;
  outcome: "passed" | "failed" | null;
  /** The project bill created after a spending vote passed: collect before the work starts. */
  requestId?: string | null;
}

export type DocKind = "easement" | "plat" | "agreement" | "insurance" | "minutes" | "survey" | "tax" | "other";

export interface DocItem {
  id: string;
  kind: DocKind;
  title: string;
  fileId: string | null;
  fileName: string | null;
  mime: string | null;
  size: number | null;
  addedAt: ISOTime;
  note: string;
}

export interface AgreementTerms {
  repairThreshold: "majority" | "two-thirds";
  improvementThreshold: "two-thirds" | "unanimous";
  emergencyLimit: number;
  dueDays: number;
  lateFee: number;
  graceDays: number;
  interestPct: number;
  lienRights: boolean;
  reserveTarget: number;
  insuranceRequired: boolean;
  insuranceMin: number;
  newLots: "same-method" | "vote";
  disputes: "mediation-then-court" | "small-claims";
  meetingMonth: string;
  roadDescription: string;
  includesDrainage: boolean;
  includesSnow: boolean;
}

export type AgreementStep = "draft" | "review" | "signing" | "notary" | "recording" | "recorded";

export interface Signature {
  homeId: string;
  name: string;
  at: ISOTime;
  via: "link" | "in-person";
  version: number;
}

export interface Agreement {
  terms: AgreementTerms;
  step: AgreementStep;
  version: number;
  updatedAt: ISOTime;
  packagePurchasedAt: ISOTime | null;
  review: { attorney: string; firm: string; requestedAt: ISOTime; approvedAt: ISOTime | null; notes: string } | null;
  signatures: Signature[];
  notary: { provider: string; scheduledFor: ISOTime | null; completedAt: ISOTime | null } | null;
  recording: { county: string; instrument: string; bookPage: string; recordedOn: ISODate } | null;
}

export interface Requester {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: "title" | "lender" | "attorney" | "agent" | "seller" | "buyer" | "other";
}

export interface LetterSnapshot {
  roadName: string;
  roadCode: string;
  county: string;
  state: string;
  lengthFt: number;
  surface: Surface;
  homesCount: number;
  /** Optional on letters issued before these were asked. */
  easementRef?: string | null;
  allWeather?: boolean | null;
  property: { label: string; address: string; owners: string };
  agreement: {
    status: "recorded" | "signed" | "in-progress" | "none";
    step: AgreementStep;
    signed: number;
    total: number;
    recording: Agreement["recording"];
    defaultLaw: string | null;
  };
  account: { balance: number; pending: number; reserve: number };
  propertyDues: { title: string | null; billed: number; paid: number; outstanding: number; lastPaidAt: ISOTime | null; onPlan: boolean; dueDate: ISODate | null };
  annualShare: number | null;
  sharePct: number | null;
  shareMethod: SplitMethod;
  roadDues: { year: number; billed: number; collected: number; homesPaid: number; homesBilled: number };
  upcoming: { title: string; amount: number | null; status: string }[];
  insuranceOnFile: boolean;
  captain: { name: string; phone: string; email: string };
}

export interface StatusLetter {
  id: string;
  code: string;
  createdAt: ISOTime;
  validUntil: ISODate;
  homeId: string;
  requester: Requester;
  closingDate: ISODate | null;
  fee: number;
  paidBy: "seller" | "closing" | "road";
  requestId: string | null;
  /** Set on a free updated copy of an earlier letter (one update within 30 days is included). */
  updateOf?: string | null;
  snapshot: LetterSnapshot;
}

export interface LetterRequest {
  id: string;
  createdAt: ISOTime;
  homeId: string | null;
  propertyAddress: string;
  requester: Requester;
  closingDate: ISODate | null;
  status: "new" | "fulfilled" | "declined";
  letterId: string | null;
  note: string;
  /** Set when the requester paid the letter fee through Stripe (refunded if declined). */
  paidIntentId?: string | null;
}

/** Money the road has set aside for big repairs (regrading, culverts). */
export interface Reserve {
  setAside: number;
}

export interface PaymentPlan {
  id: string;
  homeId: string;
  requestId: string;
  createdAt: ISOTime;
  installments: { due: ISODate; amount: number }[];
  status: "active" | "done" | "cancelled";
}

export type NoticeKind = "friendly" | "formal" | "final";

export interface Notice {
  id: string;
  homeId: string;
  requestId: string | null;
  kind: NoticeKind;
  createdAt: ISOTime;
  channel: Channel;
  body: string;
}

/** A neighbor said a check is on its way. Cleared when the captain records a check or cash payment. */
export interface CheckNote {
  id: string;
  homeId: string;
  requestId: string;
  amount: number;
  at: ISOTime;
}

export interface MessageLog {
  id: string;
  at: ISOTime;
  kind: "dues" | "reminder" | "notice" | "vote" | "agreement" | "letter" | "general";
  channel: Channel;
  homeIds: string[];
  body: string;
}

export interface Activity {
  id: string;
  at: ISOTime;
  actor: string;
  text: string;
}

export interface RoadSettings {
  payerCoversFees: boolean;
  showPaidNames: boolean;
  reminderDays: number[];
  /** Send reminders automatically on reminderDays (relative to the due date). Default on. */
  autoReminders?: boolean;
}

export interface Account {
  /** "pending": a Stripe account exists but Stripe hasn't enabled payments yet. */
  status: "none" | "pending" | "connected";
  /** Set when the road connected a real Stripe account (live or test keys). */
  stripeAccountId?: string | null;
  bankName: string;
  last4: string;
  connectedAt: ISOTime | null;
  openingBalance: number;
  openingDate: ISODate | null;
}

export interface Road {
  schema: 1;
  id: string;
  /** Demo roads always simulate payments and messages, even when real providers are configured. */
  demo?: boolean;
  code: string;
  name: string;
  state: string;
  county: string;
  town: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  surface: Surface;
  lengthFt: number;
  /** Where the access easement is recorded, e.g. "Liber 412, Page 88". Lenders check it. */
  easementRef?: string;
  /** Passable by an ordinary car all year. Lenders ask about it. null = not answered. */
  allWeather?: boolean | null;
  path: LatLng[];
  center: LatLng | null;
  captainHomeId: string | null;
  plan: Plan;
  split: SplitSettings;
  budget: BudgetLine[];
  account: Account;
  settings: RoadSettings;
  homes: Home[];
  requests: DuesRequest[];
  payments: Payment[];
  expenses: Expense[];
  contractors: Contractor[];
  work: WorkEntry[];
  votes: Vote[];
  docs: DocItem[];
  agreement: Agreement;
  letters: StatusLetter[];
  letterRequests: LetterRequest[];
  reserve: Reserve;
  plans: PaymentPlan[];
  /** Checks neighbors said they mailed. Optional so older saved roads still load. */
  checkNotes?: CheckNote[];
  notices: Notice[];
  messages: MessageLog[];
  activity: Activity[];
  /** Paid plan bookkeeping when plans are billed through Stripe. */
  billing?: { customerId: string | null; subscriptionId: string | null; paidThrough: ISODate | null };
}
