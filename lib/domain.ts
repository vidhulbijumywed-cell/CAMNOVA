export const money = (paise: number | null | undefined) =>
  paise == null
    ? "Not set"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(paise / 100);
export const bookingNumber = (id: number) =>
  `BK-${String(id).padStart(6, "0")}`;
export function toPaise(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const text = String(input).replace(/rs\.?|₹|,|\s|\/-/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Amount must be a non-negative number with up to two decimals",
    );
  const [whole, decimal = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 2_000_000_000)
    throw new Error("Amount exceeds supported limit");
  return result;
}
export function ledger(
  payments: { amount: number; kind: string }[],
  total: number | null,
) {
  const paid = payments
    .filter((p) => p.kind === "RENTAL")
    .reduce((n, p) => n + p.amount, 0);
  const deposit = payments
    .filter((p) => p.kind === "DEPOSIT")
    .reduce((n, p) => n + p.amount, 0);
  return {
    paid,
    deposit,
    balance: total === null ? null : total - paid,
    paymentStatus:
      total === null
        ? "No amount"
        : paid >= total
          ? "Paid"
          : paid > 0
            ? "Partial"
            : "Pending",
  };
}
export function rentalDays(start: Date, end: Date, policy = "24H") {
  if (end <= start) throw new Error("Return must be after pickup");
  if (policy === "CALENDAR")
    return Math.max(
      1,
      Math.ceil(
        (new Date(
          end.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
        ).getTime() -
          new Date(
            start.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
          ).getTime()) /
          86400000,
      ) + 1,
    );
  return Math.max(1, Math.ceil((+end - +start) / 86400000));
}
export const defaultSettings = {
  businessName: "CAMNOVA Rentals",
  address: "",
  phone: "",
  email: "",
  gst: "",
  taxPercent: 0,
  invoicePrefix: "CN",
  rentalPolicy: "24H",
  turnaroundMinutes: 0,
  paymentModeRequiredFrom: "2026-10-01",
  terms: "",
  paymentInstructions: "",
  templates: {
    confirmation:
      "Hi {customer}, your CAMNOVA booking {booking} is confirmed. Total: {total}.",
    pickup:
      "Hi {customer}, your equipment for {booking} is ready for pickup at {pickup}.",
    return:
      "Hi {customer}, please return your equipment for {booking} by {return}.",
    collection:
      "Hi {customer}, the outstanding balance for CAMNOVA booking {booking} is {balance}. Thank you!",
  },
};
export type BusinessSettings = typeof defaultSettings;
export function monthWindow(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
  const start = new Date(`${month}-01T00:00:00+05:30`);
  const [year, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, m, 1) - 19800000);
  return { start, end, days: Math.round((+end - +start) / 86400000) };
}
export function safeCell(value: unknown) {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
