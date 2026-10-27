// Turns what a neighbor's browser sends into a trusted command. Amounts, fees
// and timestamps are rebuilt here so a tampered request can't change them.

import { assertNeighborCommand, buildPayment, CommandError, type Command } from "./commands.ts";
import { homeOpenBills } from "./selectors.ts";
import type { ISOTime, Road } from "./types.ts";

export function prepareNeighborCommand(road: Road, homeId: string, cmd: Command, at: ISOTime): Command {
  assertNeighborCommand(road, homeId, cmd);
  switch (cmd.type) {
    case "payment.record": {
      const p = cmd.payment;
      if (road.payments.some((x) => x.id === p.id)) return cmd; // retry of a payment already recorded
      const bills = homeOpenBills(road, homeId, new Date(at));
      const bill = bills.find((b) => b.request.id === p.requestId);
      if (!bill) throw new CommandError("This bill is already paid or closed.", 409);
      const amount = Math.min(p.amount, bill.line.outstanding);
      if (amount < 100) throw new CommandError("Online payments must be at least $1.");
      const payment = buildPayment(road, {
        id: p.id,
        homeId,
        requestId: bill.request.id,
        amount,
        method: p.method,
        payerName: p.payerName.slice(0, 80) || "Neighbor",
        note: "",
        recordedBy: "neighbor",
        paidAt: at,
      });
      return { type: "payment.record", payment };
    }
    case "vote.cast":
      return { ...cmd, ballot: { ...cmd.ballot, at, via: "link" } };
    case "agreement.sign":
      return { ...cmd, signature: { ...cmd.signature, name: cmd.signature.name.slice(0, 120), at, via: "link" } };
    case "home.contact": {
      const patch = cmd.patch;
      return {
        ...cmd,
        patch: {
          phone: patch.phone?.slice(0, 40),
          email: patch.email?.slice(0, 120),
          smsOptIn: patch.smsOptIn,
          emailOptIn: patch.emailOptIn,
        },
      };
    }
    default:
      return cmd;
  }
}
