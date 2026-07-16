import { useState, useEffect } from "react";
import { connectWallet, onWalletChange } from "./wallet";
import {
  getRegistryOf,
  createRegistry,
  createInvoice,
  getAllInvoices,
  getInvoice,
  payInvoice,
} from "./contracts";
import {
  formatUSDC,
  statusInfo,
  formatDates,
  formatInvoiceNumber,
  shortAddr,
} from "./format";
import { buildPaymentLink, buildQRCode, sendInvoiceEmail } from "./share";
import "./index.css";

export default function App() {
  const [address, setAddress] = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [registry, setRegistry] = useState(null);
  const [checkingRegistry, setCheckingRegistry] = useState(false);
  const [creating, setCreating] = useState(false);

  const [tab, setTab] = useState("registry");

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [notice, setNotice] = useState("");

  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [shareOpen, setShareOpen] = useState(null);
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);

  // E-mail sending (share panel)
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");

  const [payTarget, setPayTarget] = useState(null);
  const [payInvoiceData, setPayInvoiceData] = useState(null);
  const [loadingPay, setLoadingPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payNotice, setPayNotice] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reg = params.get("registry");
    const inv = params.get("invoice");
    if (reg && inv) {
      setPayTarget({ registry: reg, invoice: inv });
      setTab("pay");
      loadPayInvoice(reg, inv);
    }
  }, []);

  async function handleConnect() {
    setError("");
    setNotice("");
    setConnecting(true);
    try {
      const { address, walletClient } = await connectWallet();
      setAddress(address);
      setWalletClient(walletClient);
      if (!payTarget) {
        await checkRegistry(address);
      }
    } catch (err) {
      setError(err.message || "Could not connect the wallet.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkRegistry(addr) {
    setCheckingRegistry(true);
    try {
      const reg = await getRegistryOf(addr);
      setRegistry(reg);
      if (reg) await loadInvoices(reg);
    } catch (err) {
      setError("Could not verify your registry. Please try again.");
    } finally {
      setCheckingRegistry(false);
    }
  }

  async function handleCreateRegistry() {
    setError("");
    setNotice("");
    setCreating(true);
    try {
      const reg = await createRegistry(walletClient, address);
      setRegistry(reg);
      setNotice("Registry created successfully.");
    } catch (err) {
      const msg = err.shortMessage || err.message || "";
      if (msg.includes("registry already exists")) {
        setError("This wallet already has a registry.");
        await checkRegistry(address);
      } else if (msg.toLowerCase().includes("rejected")) {
        setError("Transaction cancelled in the wallet.");
      } else {
        setError("Could not create the registry. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function loadInvoices(reg) {
    const target = reg || registry;
    if (!target) return;
    setLoadingInvoices(true);
    setError("");
    try {
      const list = await getAllInvoices(target);
      setInvoices([...list].reverse());
    } catch (err) {
      // Only show the error if we have nothing to display yet
      if (invoices.length === 0) {
        setError("Could not load invoices. Tap Refresh to try again.");
      }
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function handleIssue() {
    setError("");
    setNotice("");
    const amt = amount.trim().replace(",", ".");
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
      setError("Enter a valid USDC amount (e.g. 250.00).");
      return;
    }
    if (!description.trim()) {
      setError("Describe the service or product of the invoice.");
      return;
    }
    setIssuing(true);
    try {
      await createInvoice(walletClient, address, registry, amt, description.trim());
      setNotice("Invoice issued successfully.");
      setAmount("");
      setDescription("");
      await loadInvoices(registry);
      setTab("invoices");
    } catch (err) {
      const msg = err.shortMessage || err.message || "";
      if (msg.toLowerCase().includes("rejected")) {
        setError("Transaction cancelled in the wallet.");
      } else {
        setError("Could not issue the invoice. Please try again.");
      }
    } finally {
      setIssuing(false);
    }
  }

  async function toggleShare(inv) {
    setEmailTo("");
    setEmailMsg("");
    setEmailErr("");
    if (shareOpen === String(inv.id)) {
      setShareOpen(null);
      setQrData("");
      return;
    }
    setShareOpen(String(inv.id));
    setCopied(false);
    const link = buildPaymentLink(registry, inv.id);
    try {
      const qr = await buildQRCode(link);
      setQrData(qr);
    } catch {
      setQrData("");
    }
  }

  async function handleSendEmail(inv) {
    setEmailMsg("");
    setEmailErr("");
    const email = emailTo.trim();
    if (!email || !email.includes("@") || !email.includes(".")) {
      setEmailErr("Enter a valid e-mail address.");
      return;
    }
    setSendingEmail(true);
    try {
      const link = buildPaymentLink(registry, inv.id);
      await sendInvoiceEmail(email, inv, link);
      setEmailMsg("Invoice sent to " + email + ".");
      setEmailTo("");
    } catch (err) {
      setEmailErr(err.message || "Could not send the e-mail.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function copyLink(inv) {
    const link = buildPaymentLink(registry, inv.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link.");
    }
  }

  async function loadPayInvoice(reg, inv) {
    setLoadingPay(true);
    setPayError("");
    try {
      const data = await getInvoice(reg, inv);
      setPayInvoiceData(data);
    } catch (err) {
      setPayError("Invoice not found. Please check the link.");
    } finally {
      setLoadingPay(false);
    }
  }

  async function handlePay() {
    setPayError("");
    setPayNotice("");
    if (!walletClient) {
      setPayError("Connect your wallet to pay.");
      return;
    }
    setPaying(true);
    try {
      await payInvoice(
        walletClient,
        address,
        payTarget.registry,
        payTarget.invoice,
        payInvoiceData.amount
      );
      setPayNotice("Invoice paid successfully.");
      await loadPayInvoice(payTarget.registry, payTarget.invoice);
    } catch (err) {
      const msg = err.shortMessage || err.message || "";
      if (msg.toLowerCase().includes("rejected")) {
        setPayError("Transaction cancelled in the wallet.");
      } else if (msg.includes("not pending")) {
        setPayError("This invoice is no longer pending.");
      } else {
        setPayError("Could not pay the invoice. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  }

  useEffect(() => {
    onWalletChange(() => {
      setAddress(null);
      setWalletClient(null);
      setRegistry(null);
      setInvoices([]);
      setNotice("");
    });
  }, []);

  const scanBase = "https://testnet.arcscan.app/address/";
  const hasRegistry = Boolean(registry);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-name">
              Arc<span>Bill</span>
            </div>
            <div className="brand-sub">Invoices in USDC · Arc Testnet</div>
          </div>
        </div>

        {address ? (
          <div className="account-pill">
            <span className="account-dot" />
            {shortAddr(address)}
          </div>
        ) : (
          <button
            className="btn-connect"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </header>

      <section className="hero">
        <h1>
          Your own <span>onchain invoice book</span>
        </h1>
        <p>
          Each wallet gets its own individual registry on Arc, with its own
          numbering and verifiable payment proof in USDC. Issue, receive and
          track your invoices, all on the blockchain.
        </p>
      </section>

      {payTarget ? (
        <div className="card">
          <div className="card-title">Pay invoice</div>
          <div className="card-desc">
            You opened a payment link. Review the details and pay in USDC on the
            Arc network.
          </div>

          {loadingPay ? (
            <div className="msg msg-info">Loading invoice…</div>
          ) : payInvoiceData ? (
            <>
              <div className="invoice">
                <div className="invoice-top">
                  <span className="invoice-num">
                    #{formatInvoiceNumber(payInvoiceData.id)}
                  </span>
                  <span className={"badge " + statusInfo(payInvoiceData.status).cls}>
                    {statusInfo(payInvoiceData.status).label}
                  </span>
                </div>
                <div className="invoice-amount">
                  {formatUSDC(payInvoiceData.amount)}{" "}
                  <span className="usdc">USDC</span>
                </div>
                <div className="invoice-desc">{payInvoiceData.description}</div>
              </div>

              {Number(payInvoiceData.status) === 0 ? (
                !address ? (
                  <div className="msg msg-info">
                    Connect your wallet at the top of the page to pay.
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={handlePay}
                    disabled={paying}
                  >
                    {paying
                      ? "Paying… (confirm in your wallet)"
                      : "Pay " + formatUSDC(payInvoiceData.amount) + " USDC"}
                  </button>
                )
              ) : Number(payInvoiceData.status) === 1 ? (
                <div className="msg msg-ok">This invoice has already been paid.</div>
              ) : (
                <div className="msg msg-info">This invoice was cancelled.</div>
              )}

              {payNotice && <div className="msg msg-ok">{payNotice}</div>}
              {payError && <div className="msg msg-error">{payError}</div>}
            </>
          ) : (
            <div className="msg msg-error">
              {payError || "Invoice not found."}
            </div>
          )}

          <button
            className="btn-refresh back-btn"
            onClick={() => {
              setPayTarget(null);
              window.history.replaceState({}, "", window.location.pathname);
            }}
          >
            ← Go to ArcBill
          </button>
        </div>
      ) : !address ? (
        <div className="card">
          <div className="connect-prompt">
            <div className="big">Connect to get started</div>
            <div className="muted">
              Use the “Connect wallet” button at the top of the page to connect
              your OKX or MetaMask on the Arc Testnet and create your registry.
            </div>
            {error && <div className="msg msg-error">{error}</div>}
          </div>
        </div>
      ) : (
        <>
          <nav className="tabs">
            <button
              className={tab === "registry" ? "tab active" : "tab"}
              onClick={() => setTab("registry")}
            >
              My registry
            </button>
            <button
              className={tab === "issue" ? "tab active" : "tab"}
              onClick={() => setTab("issue")}
              disabled={!hasRegistry}
            >
              Issue invoice
            </button>
            <button
              className={tab === "invoices" ? "tab active" : "tab"}
              onClick={() => setTab("invoices")}
              disabled={!hasRegistry}
            >
              My invoices
            </button>
          </nav>

          {tab === "registry" && (
            <div className="card">
              <div className="card-title">My registry</div>
              <div className="card-desc">
                Your registry is an individual contract on Arc where your
                invoices are stored, with its own numbering, independent from
                other issuers.
              </div>

              {checkingRegistry ? (
                <div className="msg msg-info">Checking your registry…</div>
              ) : registry ? (
                <>
                  <div className="reg-box">
                    <div className="reg-row">
                      <span className="reg-label">Status</span>
                      <span className="badge badge-ok">Active registry</span>
                    </div>
                    <div className="reg-row">
                      <span className="reg-label">Registry address</span>
                      <a
                        className="reg-addr"
                        href={scanBase + registry}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddr(registry)} ↗
                      </a>
                    </div>
                  </div>
                  <button className="btn-primary" disabled>
                    Registry already created
                  </button>
                  {notice && <div className="msg msg-ok">{notice}</div>}
                </>
              ) : (
                <>
                  <div className="msg msg-info">
                    This wallet does not have a registry yet. Create yours to
                    start issuing invoices.
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleCreateRegistry}
                    disabled={creating}
                  >
                    {creating ? "Creating registry…" : "Create my registry"}
                  </button>
                </>
              )}

              {error && <div className="msg msg-error">{error}</div>}
            </div>
          )}

          {tab === "issue" && (
            <div className="card">
              <div className="card-title">Issue invoice</div>
              <div className="card-desc">
                The invoice gets its own sequential number in your registry
                (001, 002, 003…) and is recorded on Arc.
              </div>

              <label className="field-label">Amount (USDC)</label>
              <input
                className="field"
                type="text"
                inputMode="decimal"
                placeholder="250.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <label className="field-label">Service or product description</label>
              <textarea
                className="field"
                rows={3}
                placeholder="e.g. Accounting services — July 2026"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button
                className="btn-primary"
                onClick={handleIssue}
                disabled={issuing}
              >
                {issuing ? "Issuing…" : "Issue invoice"}
              </button>

              {notice && <div className="msg msg-ok">{notice}</div>}
              {error && <div className="msg msg-error">{error}</div>}
            </div>
          )}

          {tab === "invoices" && (
            <div className="card">
              <div className="invoices-head">
                <div>
                  <div className="card-title">My invoices</div>
                  <div className="card-desc">
                    Read directly from your registry on Arc.
                  </div>
                </div>
                <button
                  className="btn-refresh"
                  onClick={() => loadInvoices(registry)}
                  disabled={loadingInvoices}
                >
                  {loadingInvoices ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {loadingInvoices && invoices.length === 0 ? (
                <div className="msg msg-info">Loading invoices…</div>
              ) : invoices.length === 0 ? (
                <div className="msg msg-info">
                  You haven’t issued any invoice yet. Go to “Issue invoice” to
                  create the first one.
                </div>
              ) : (
                <div className="invoice-list">
                  {invoices.map((inv) => {
                    const st = statusInfo(inv.status);
                    const dates = formatDates(inv.createdAt);
                    const paidDates = formatDates(inv.paidAt);
                    const isOpen = shareOpen === String(inv.id);
                    const link = buildPaymentLink(registry, inv.id);
                    return (
                      <div className="invoice" key={String(inv.id)}>
                        <div className="invoice-top">
                          <span className="invoice-num">
                            #{formatInvoiceNumber(inv.id)}
                          </span>
                          <span className={"badge " + st.cls}>{st.label}</span>
                        </div>
                        <div className="invoice-amount">
                          {formatUSDC(inv.amount)}{" "}
                          <span className="usdc">USDC</span>
                        </div>
                        <div className="invoice-desc">{inv.description}</div>
                        <div className="invoice-meta">
                          <span>Issued (UTC): {dates.utc}</span>
                          <span>Issued (BRT): {dates.brt}</span>
                        </div>
                        {Number(inv.status) === 1 && (
                          <div className="invoice-meta paid">
                            <span>Paid by: {shortAddr(inv.payer)}</span>
                            <span>On (BRT): {paidDates.brt}</span>
                          </div>
                        )}

                        <div className="invoice-actions">
                          <button
                            className="btn-mini"
                            onClick={() => toggleShare(inv)}
                          >
                            {isOpen ? "Hide" : "Share"}
                          </button>
                        </div>

                        {isOpen && (
                          <div className="share-panel">
                            {qrData && (
                              <img
                                className="qr"
                                src={qrData}
                                alt="Invoice QR Code"
                              />
                            )}
                            <div className="share-actions">
                              <button
                                className="btn-mini"
                                onClick={() => copyLink(inv)}
                              >
                                {copied ? "Link copied!" : "Copy link"}
                              </button>
                            </div>
                            <div className="share-hint">
                              The QR and the link open this invoice’s payment
                              page.
                            </div>

                            <div className="email-box">
                              <label className="field-label">
                                Send invoice to customer’s e-mail
                              </label>
                              <div className="email-row">
                                <input
                                  className="field"
                                  type="email"
                                  placeholder="customer@email.com"
                                  value={emailTo}
                                  onChange={(e) => setEmailTo(e.target.value)}
                                />
                                <button
                                  className="btn-mini send-btn"
                                  onClick={() => handleSendEmail(inv)}
                                  disabled={sendingEmail}
                                >
                                  {sendingEmail ? "Sending…" : "Send"}
                                </button>
                              </div>
                              {emailMsg && (
                                <div className="msg msg-ok">{emailMsg}</div>
                              )}
                              {emailErr && (
                                <div className="msg msg-error">{emailErr}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {error && <div className="msg msg-error">{error}</div>}
            </div>
          )}
        </>
      )}

      <footer className="footer">
        <span>ArcBill · built on Arc Testnet</span>
        <nav className="footer-links">
          <a href="https://www.arc.io/" target="_blank" rel="noreferrer">
            Official site
          </a>
          <a href="https://docs.arc.io/" target="_blank" rel="noreferrer">
            Documentation
          </a>
          <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer">
            USDC Faucet
          </a>
          <a
            href="https://testnet.arcscan.app/address/0x689436F88b58aC398b46c8061CD2a009A6c1273b"
            target="_blank"
            rel="noreferrer"
          >
            Contract on ArcScan
          </a>
        </nav>
      </footer>
    </div>
  );
}
