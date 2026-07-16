// ArcBill — endpoint de envio de fatura por e-mail (Vercel serverless + Gmail)
// Usa as variáveis de ambiente EMAIL_SENDER e EMAIL_PASSWORD (senha de app do Gmail).
const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  // Só aceita POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const {
      to, // e-mail do cliente (destinatário)
      invoiceNumber, // ex "001"
      amount, // ex "250.00"
      description, // descrição do serviço
      link, // link de pagamento
      issuedUTC, // data de emissão em UTC
      issuedBRT, // data de emissão em BRT
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

    // Configura o transporte pelo Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: sender,
        pass: password,
      },
    });

    const amountLine = amount ? `${amount} USDC` : "";
    const descLine = description
      ? `<p style="margin:0 0 8px;color:#444;">Description: ${description}</p>`
      : "";
    const dateLine =
      issuedUTC || issuedBRT
        ? `<p style="margin:0 0 4px;color:#888;font-size:13px;">Issued (UTC): ${
            issuedUTC || "—"
          }</p>
           <p style="margin:0 0 16px;color:#888;font-size:13px;">Issued (BRT): ${
             issuedBRT || "—"
           }</p>`
        : "";

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
          <p style="margin:0 0 16px;color:#c9c9cf;">Hi! Here is your invoice.</p>
          <div style="background:#1e2025;border:1px solid #2f3138;border-radius:10px;padding:18px;margin-bottom:18px;">
            <p style="margin:0 0 6px;color:#85868d;font-size:13px;">Invoice #${invoiceNumber}</p>
            <p style="margin:0 0 10px;font-size:24px;font-weight:600;color:#f2f2f4;">${amountLine}</p>
            ${descLine}
            ${dateLine}
          </div>
          <a href="${link}" style="display:inline-block;background:#ef9f27;color:#412402;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">Pay this invoice</a>
          <p style="margin:18px 0 0;color:#85868d;font-size:12px;">Pay in USDC on the Arc network by connecting your wallet on the page above.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `ArcBill <${sender}>`,
      to,
      cc: sender, // cópia pro remetente
      subject: `ArcBill Invoice #${invoiceNumber}`,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("invoice-email error:", err);
    res.status(500).json({ error: "Could not send the e-mail." });
  }
};
