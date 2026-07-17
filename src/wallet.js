// ArcBill — wallet connection (injected: OKX/MetaMask) and viem clients
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  fallback,
  publicActions,
} from "viem";
import { ARC_TESTNET, CHAIN_ID_HEX } from "./config";

// RPCs oficiais da Arc Testnet (docs.arc.io). Usa fallback: se um responder
// 429/erro, o viem tenta o próximo automaticamente.
const ARC_RPCS = [
  "https://rpc.testnet.arc.io",
  "https://rpc.blockdaemon.testnet.arc.io",
  "https://rpc.drpc.testnet.arc.io",
  "https://rpc.quicknode.testnet.arc.io",
];

export const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: fallback(
    ARC_RPCS.map((url) =>
      http(url, { retryCount: 2, retryDelay: 1200, timeout: 30000 })
    ),
    { rank: false }
  ),
  pollingInterval: 6000,
});

// Finds the injected provider, checking OKX's own namespace first.
function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  // OKX injects itself here (and also in window.ethereum)
  if (window.okxwallet) return window.okxwallet;
  if (window.ethereum) return window.ethereum;
  return null;
}

export async function ensureArcNetwork(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603)) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: ARC_TESTNET.name,
            nativeCurrency: ARC_TESTNET.nativeCurrency,
            rpcUrls: ARC_TESTNET.rpcUrls.default.http,
            blockExplorerUrls: [ARC_TESTNET.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet() {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No wallet found. Please install OKX Wallet or MetaMask."
    );
  }

  const accounts = await provider.request({
    method: "eth_requestAccounts",
  });
  const address = accounts[0];

  await ensureArcNetwork(provider);

  const walletClient = createWalletClient({
    account: address,
    chain: ARC_TESTNET,
    transport: custom(provider),
  }).extend(publicActions);

  return { address, walletClient };
}

export function onWalletChange(callback) {
  const provider = getInjectedProvider();
  if (!provider) return;
  provider.on?.("accountsChanged", callback);
  provider.on?.("chainChanged", callback);
}
