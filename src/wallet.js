// ArcBill — conexão de carteira (injected: OKX/MetaMask) e clientes viem
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  publicActions,
} from "viem";
import { ARC_TESTNET, CHAIN_ID_HEX } from "./config";

// Cliente público (leitura da blockchain) — usa o RPC da Arc.
// Configurado para tolerar rate limit (429): tenta novamente com espera,
// e usa um intervalo de polling mais espaçado para não sobrecarregar o RPC.
export const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: http(undefined, {
    retryCount: 5,
    retryDelay: 2000, // espera 2s entre tentativas quando o RPC responde 429
    timeout: 60000,
  }),
  pollingInterval: 4000, // consulta a blockchain a cada 4s (menos requisições)
});

function getInjectedProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }
  return window.ethereum;
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
      "Nenhuma carteira encontrada. Instale a OKX Wallet ou MetaMask."
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
