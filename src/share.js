// ArcBill — invoice sharing: link, QR Code and e-mail
import QRCode from "qrcode";
import { formatUSDC, formatInvoiceNumber } from "./format";

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

// Builds a mailto: opens the user's e-mail app with the invoice ready.
export function buildMailto(invoice, link) {
  const num = formatInvoiceNumber(invoice.id);
  const value = formatUSDC(invoice.amount);
  const subject = `ArcBill Invoice #${num}`;
  const body =
    `Hi!\n\n` +
    `Here is invoice #${num} for ${value} USDC` +
    (invoice.description ? ` regarding "${invoice.description}".` : ".") +
    `\n\nTo pay on the Arc network, open the link below and connect your wallet:\n${link}\n\n` +
    `Thank you.`;
  return (
    "mailto:?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}
