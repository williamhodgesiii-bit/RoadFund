// Fee math for neighbor payments. Rates mirror Stripe's published US pricing:
// bank debit (ACH) 0.8% capped at $5, cards 2.9% + 30¢. Road Fund adds $1 per payment.

export const PLATFORM_FEE = 100;
export const ACH_RATE = 0.008;
export const ACH_CAP = 500;
export const CARD_RATE = 0.029;
export const CARD_FIXED = 30;

export type OnlineMethod = "ach" | "card";

export interface Charge {
  share: number;
  platformFee: number;
  processingFee: number;
  /** Total the payer is charged. */
  total: number;
  /** What the road account receives. */
  roadNet: number;
}

function processingOn(amount: number, method: OnlineMethod): number {
  if (method === "ach") return Math.min(Math.round(amount * ACH_RATE), ACH_CAP);
  return Math.round(amount * CARD_RATE) + CARD_FIXED;
}

/**
 * When the payer covers fees, the charge is grossed up so the road receives the
 * full share after processing. When the road absorbs fees, the payer pays the
 * share and the fees come out of what the road receives.
 */
export function computeCharge(share: number, method: OnlineMethod, payerCoversFees: boolean): Charge {
  if (share <= 0) return { share: 0, platformFee: 0, processingFee: 0, total: 0, roadNet: 0 };

  if (!payerCoversFees) {
    const processingFee = processingOn(share, method);
    return {
      share,
      platformFee: PLATFORM_FEE,
      processingFee,
      total: share,
      roadNet: share - PLATFORM_FEE - processingFee,
    };
  }

  const base = share + PLATFORM_FEE;
  let total: number;
  if (method === "ach") {
    const capped = base + ACH_CAP;
    // If the uncapped fee would exceed the cap, the cap applies.
    total = Math.round(capped * ACH_RATE) >= ACH_CAP ? capped : Math.ceil(base / (1 - ACH_RATE));
  } else {
    total = Math.ceil((base + CARD_FIXED) / (1 - CARD_RATE));
  }
  // Settle any rounding gap so total - fees === share exactly.
  const processingFee = total - base;
  return { share, platformFee: PLATFORM_FEE, processingFee, total, roadNet: share };
}

/** Days until an online payment settles into the road account. */
export const SETTLE_BUSINESS_DAYS: Record<OnlineMethod, number> = { ach: 4, card: 2 };
