// ArcBill — formatting helpers
import { formatUnits } from "viem";

// Format USDC amount (6 decimals) for display, e.g. "250.00"
export function formatUSDC(rawAmount) {
  const v = Number(formatUnits(rawAmount, 6));
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Status label from the contract number (0/1/2)
export function statusInfo(statusNum) {
  const n = Number(statusNum);
  if (n === 1) return { label: "Paid", cls: "badge-paid" };
  if (n === 2) return { label: "Cancelled", cls: "badge-cancel" };
  return { label: "Pending", cls: "badge-pending" };
}

// Convert timestamp (seconds, UTC) to readable dates in UTC and BRT
export function formatDates(timestampSeconds) {
  const ts = Number(timestampSeconds);
  if (!ts) return { utc: "—", brt: "—" };
  const d = new Date(ts * 1000);

  const utc = d.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const brt = d.toLocaleString("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { utc, brt };
}

// Invoice number with leading zeros, e.g. 1 -> "001"
export function formatInvoiceNumber(id) {
  return String(Number(id)).padStart(3, "0");
}

export function shortAddr(addr) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return "—";
  }
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
