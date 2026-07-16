// ArcBill — funções que falam com os contratos (Factory e Registry)
import { parseUnits } from "viem";
import { publicClient } from "./wallet";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  REGISTRY_ABI,
  USDC_ADDRESS,
  USDC_ABI,
} from "./config";

const ZERO = "0x0000000000000000000000000000000000000000";

// Pergunta à Factory qual o registro de uma carteira.
export async function getRegistryOf(userAddress) {
  const registry = await publicClient.readContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getRegistry",
    args: [userAddress],
  });
  if (!registry || registry.toLowerCase() === ZERO) {
    return null;
  }
  return registry;
}

// Cria o registro da carteira conectada.
export async function createRegistry(walletClient, userAddress) {
  const hash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "createRegistry",
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return await getRegistryOf(userAddress);
}

// Emite uma fatura no registro.
export async function createInvoice(
  walletClient,
  userAddress,
  registryAddress,
  amountText,
  description
) {
  const amount = parseUnits(amountText, 6);
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "createInvoice",
    args: [amount, description],
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// Lê todas as faturas de um registro.
export async function getAllInvoices(registryAddress) {
  const list = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getAllInvoices",
  });
  return list;
}

// Lê uma fatura específica pelo id.
export async function getInvoice(registryAddress, id) {
  const invoice = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "getInvoice",
    args: [BigInt(id)],
  });
  return invoice;
}

// Paga uma fatura. Verifica a autorização (allowance) antes de aprovar:
// se já houver autorização suficiente, pula o approve e vai direto ao pagamento.
// Na Arc o allowance às vezes retorna vazio; nesse caso, aprova normalmente.
export async function payInvoice(
  walletClient,
  userAddress,
  registryAddress,
  id,
  rawAmount
) {
  let needsApprove = true;

  // Tenta ler a autorização atual (pode falhar na Arc — tratamos com try/catch)
  try {
    const current = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [userAddress, registryAddress],
    });
    if (current >= rawAmount) {
      needsApprove = false;
    }
  } catch {
    needsApprove = true;
  }

  // 1) approve (só se necessário)
  if (needsApprove) {
    const approveHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [registryAddress, rawAmount],
      account: userAddress,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  // 2) payInvoice
  const payHash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "payInvoice",
    args: [BigInt(id)],
    account: userAddress,
  });
  await publicClient.waitForTransactionReceipt({ hash: payHash });
  return payHash;
}

// Busca o hash da transação que pagou uma fatura (evento InvoicePaid).
// Retorna o txHash, ou null se não encontrar.
// Busca em janelas recentes de blocos para não sobrecarregar o RPC (evita 413/429).
export async function getPaymentTxHash(registryAddress, invoiceId) {
  const eventDef = {
    type: "event",
    name: "InvoicePaid",
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "payer", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  };

  try {
    const latest = await publicClient.getBlockNumber();
    const WINDOW = 9000n; // tamanho de cada janela de busca
    const MAX_WINDOWS = 12; // até ~108k blocos para trás

    let toBlock = latest;
    for (let i = 0; i < MAX_WINDOWS; i++) {
      let fromBlock = toBlock - WINDOW;
      if (fromBlock < 0n) fromBlock = 0n;

      try {
        const logs = await publicClient.getLogs({
          address: registryAddress,
          event: eventDef,
          args: { id: BigInt(invoiceId) },
          fromBlock,
          toBlock,
        });
        if (logs && logs.length > 0) {
          return logs[logs.length - 1].transactionHash;
        }
      } catch {
        // se essa janela falhar, tenta a próxima
      }

      if (fromBlock === 0n) break;
      toBlock = fromBlock - 1n;
    }
    return null;
  } catch {
    return null;
  }
}
