// ArcBill — invoice sharing: link, QR Code and e-mail
import QRCode from "qrcode";
import { formatUSDC, formatInvoiceNumber, formatDates } from "./format";

// Builds the public payment link for an invoice.
export function buildPaymentLink(registryAddress, invoiceId) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    registry: registryAddress,
    invoice: String(Number(invoiceId)),
  });
  return base + "?" + params.toString();
}

// Generates the QR Code (PNG dataURL) from a link.
export async function buildQRCode(link) {
  return await QRCode.toDataURL(link, {
    width: 220,
    margin: 1,
    color: {
      dark: "#16171b",
      light: "#faeeda",
    },
  });
}

// Sends the invoice by e-mail through the serverless endpoint (Gmail).
// Returns true on success; throws on failure.
export async function sendInvoiceEmail(toEmail, invoice, link) {
  const dates = formatDates(invoice.createdAt);
  const res = await fetch("/api/invoice-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toEmail,
      invoiceNumber: formatInvoiceNumber(invoice.id),
      amount: formatUSDC(invoice.amount),
      description: invoice.description,
      link,
      issuedUTC: dates.utc,
      issuedBRT: dates.brt,
    }),
  });

  if (!res.ok) {
    let msg = "Could not send the e-mail.";
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return true;
}
