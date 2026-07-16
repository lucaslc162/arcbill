// ArcBill — invoice e-mail endpoint (Vercel serverless + Gmail)
// Uses environment variables EMAIL_SENDER and EMAIL_PASSWORD (Gmail app password).
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const {
      to,
      invoiceNumber,
      amount,
      description,
      link,
      issuedUTC,
      issuedBRT,
      status,
      registry,
    } = req.body || {};

    if (!to || !link || !invoiceNumber) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    const sender = process.env.EMAIL_SENDER;
    const password = process.env.EMAIL_PASSWORD;

    if (!sender || !password) {
      res.status(500).json({ error: "E-mail not configured on the server." });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: sender,
        pass: password,
      },
    });

    const isPaid = Number(status) === 1;
    const explorerUrl = registry
      ? `https://testnet.arcscan.app/address/${registry}`
      : null;

    const amountLine = amount ? `${amount} USDC` : "";
    const descLine = description
      ? `<p style="margin:0 0 8px;color:#c9c9cf;">Description: ${description}</p>`
      : "";
    const dateLine =
      issuedUTC || issuedBRT
        ? `<p style="margin:0 0 4px;color:#888;font-size:13px;">Issued (UTC): ${
            issuedUTC || "—"
          }</p>
           <p style="margin:0 0 0;color:#888;font-size:13px;">Issued (BRT): ${
             issuedBRT || "—"
           }</p>`
        : "";

    // Intro line and call-to-action change depending on paid/pending
    const introLine = isPaid
      ? "Hi! Here is your invoice. This invoice has already been paid — thank you!"
      : "Hi! Here is your invoice.";

    const statusBadge = isPaid
      ? `<span style="display:inline-block;background:#854f0b;color:#faeeda;font-size:12px;padding:3px 10px;border-radius:20px;margin-bottom:10px;">Paid</span>`
      : "";

    const cta = isPaid
      ? explorerUrl
        ? `<a href="${explorerUrl}" style="display:inline-block;background:#ef9f27;color:#412402;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">View on explorer</a>`
        : ""
      : `<a href="${link}" style="display:inline-block;background:#ef9f27;color:#412402;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">Pay this invoice</a>`;

    const footerLine = isPaid
      ? `<p style="margin:18px 0 0;color:#85868d;font-size:12px;">This payment is verifiable on the Arc blockchain.</p>`
      : `<p style="margin:18px 0 0;color:#85868d;font-size:12px;">Pay in USDC on the Arc network by connecting your wallet on the page above.</p>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#16171b;border-radius:12px;overflow:hidden;color:#f2f2f4;">
        <div style="background:#ef9f27;padding:20px 24px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:#16171b;color:#ef9f27;font-weight:bold;font-size:20px;text-align:center;line-height:34px;">A</div>
            <div>
              <div style="font-size:20px;font-weight:700;color:#412402;">ArcBill</div>
              <div style="font-size:12px;color:#7a4a08;">Invoices in USDC · Arc Testnet</div>
            </div>
          </div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#c9c9cf;">${introLine}</p>
          <div style="background:#1e2025;border:1px solid #2f3138;border-radius:10px;padding:18px;margin-bottom:18px;">
            ${statusBadge}
            <p style="margin:0 0 6px;color:#85868d;font-size:13px;">Invoice #${invoiceNumber}</p>
            <p style="margin:0 0 10px;font-size:24px;font-weight:600;color:#f2f2f4;">${amountLine}</p>
            ${descLine}
            ${dateLine}
          </div>
          ${cta}
          ${footerLine}
        </div>
      </div>
    `;

    const subject = isPaid
      ? `ArcBill Invoice #${invoiceNumber} — Paid`
      : `ArcBill Invoice #${invoiceNumber}`;

    await transporter.sendMail({
      from: `ArcBill <${sender}>`,
      to,
      cc: sender,
      subject,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("invoice-email error:", err);
    res.status(500).json({ error: "Could not send the e-mail." });
  }
}
