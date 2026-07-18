# ArcBill

**Onchain invoicing on Arc Testnet - issue, share, and settle invoices in USDC, fully on the blockchain.**

🔗 Live app: [arcbillapp.xyz](https://arcbillapp.xyz)

---

## What it does

ArcBill lets anyone issue payment invoices that live entirely onchain. Each invoice is a record on a smart contract, paid in USDC, with the settlement verifiable on the block explorer.

- **Connect a wallet** (OKX / MetaMask) on Arc Testnet.
- **Create your own invoice registry** - a personal smart contract deployed just for you.
- **Issue invoices** with amount (USDC) and description. Each one gets its own sequential number (001, 002, …).
- **Share** an invoice via link or QR code, or send it by email.
- **Get paid in USDC** - the payer settles directly from their wallet to the contract.
- **Verify on the explorer** - every paid invoice links to the real payment transaction on ArcScan.

---

## What makes it different

Most onchain invoicing demos use a single shared contract for everyone. ArcBill uses a **Factory pattern**:

- The **Factory** contract creates a dedicated **Invoice Registry** contract for each wallet.
- Every user owns their registry, with their **own sequential invoice numbering** and their own record of issued and paid invoices.
- This mirrors how real accounting works: each entity keeps its own ledger, isolated and auditable.

This gives each user a clean, independent, self-owned invoicing history - instead of everyone sharing one global list.

---

## How payment works

1. The issuer creates an invoice on their registry (amount + description).
2. The payer opens the shared link and pays: the app runs an **`approve`** (authorize USDC) followed by **`payInvoice`** (transfer USDC to the invoice owner).
3. The USDC moves onchain from payer to issuer, and the invoice is marked **Paid**.
4. Both parties can open the payment transaction on ArcScan and see the **ERC-20 USDC transfer**.

---

## Tech stack

- **Frontend:** React + Vite
- **Blockchain library:** [viem](https://viem.sh)
- **Network:** Arc Testnet (Chain ID `5042002`)
- **Token:** USDC (`0x3600000000000000000000000000000000000000`, 6 decimals)
- **Gas:** paid in USDC
- **Hosting:** Vercel + custom domain
- **Email:** serverless endpoint (Nodemailer)

### RPC resilience

The app reads the chain through the **official Arc RPC endpoints**, using a `fallback` across all four providers so that if one is rate-limited, the next is tried automatically:

- `https://rpc.testnet.arc.io` (Circle)
- `https://rpc.blockdaemon.testnet.arc.io` (Blockdaemon)
- `https://rpc.drpc.testnet.arc.io` (dRPC)
- `https://rpc.quicknode.testnet.arc.io` (QuickNode)

---

## Contracts (deployed & verified on ArcScan)

- **Factory:** `0x689436F88b58aC398b46c8061CD2a009A6c1273b`

Each user's Invoice Registry is deployed on demand by the Factory when they first connect and create their registry.

---

## Getting started (local)

```bash
# install dependencies
npm install

# run the dev server
npm run dev
```

Create a `.env` file for the email endpoint (optional):

```
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

> The `.env` file is never committed. Email credentials are configured as environment variables in the hosting provider.

---

## Project structure

```
src/
  App.jsx        # main UI and app logic
  config.js      # network, contract addresses, ABIs
  wallet.js      # wallet connection + RPC public client (fallback)
  contracts.js   # contract calls (create, issue, pay, read)
  format.js      # USDC / date / status formatting
  share.js       # share link, QR code, email
api/
  invoice-email.js  # serverless email endpoint
```

---

## Network details

| Item | Value |
|------|-------|
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Currency | USDC (6 decimals) |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |

---

Built on Arc.
