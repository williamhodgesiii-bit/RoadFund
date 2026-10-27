import { Check, Landmark, ShieldCheck } from "lucide-react";

/** Static picture of the neighbor pay screen, built in HTML so it stays sharp and readable. */
export function PhoneMock() {
  return (
    <div className="relative mx-auto w-[300px] max-w-full sm:w-[320px]" aria-hidden="true">
      <div className="rounded-[2.4rem] border-[10px] border-charcoal bg-charcoal shadow-lift">
        <div className="overflow-hidden rounded-[1.7rem] bg-paper">
          <div className="flex items-center justify-between bg-pine px-5 pb-3 pt-5 text-white">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-wider opacity-80">Birch Hollow Lane</p>
              <p className="font-display text-[1.05rem] font-extrabold">Hi Hank</p>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[0.7rem] font-semibold">Lot 5</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[0.78rem] font-semibold text-stone">Your share of 2026 road dues</p>
              <p className="tnum font-display text-[2.1rem] font-black leading-tight">$317.91</p>
              <p className="text-[0.78rem] text-stone">Due May 1 · plowing, grading, gravel, savings</p>
              <div className="mt-3 rounded-xl bg-pine py-3 text-center text-[0.95rem] font-bold text-white">Pay $317.91</div>
              <p className="mt-2 text-center text-[0.72rem] text-stone underline">Why this amount?</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between text-[0.78rem]">
                <span className="font-semibold">7 of 9 homes paid</span>
                <span className="text-stone">$2,093 in</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-paper-2">
                <div className="h-2 w-[78%] rounded-full bg-pine" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-paper-2 px-3 py-2 text-[0.7rem] text-stone">
              <ShieldCheck className="h-4 w-4 shrink-0 text-pine" />
              Payments handled by Stripe. We never see your bank login.
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-7 -left-16 hidden rotate-[-4deg] rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-lift sm:block">
        <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-stone">
          <Landmark className="h-3.5 w-3.5" /> Road account
        </p>
        <p className="tnum font-display text-[1.1rem] font-extrabold">$2,093.53</p>
      </div>
      <div className="absolute -right-14 -top-6 hidden rotate-[3deg] items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-lift sm:flex">
        <span className="rounded-full bg-pine-50 p-1 text-pine">
          <Check className="h-3.5 w-3.5" />
        </span>
        <span className="text-[0.75rem] font-semibold">Becker paid $202.25</span>
      </div>
    </div>
  );
}
