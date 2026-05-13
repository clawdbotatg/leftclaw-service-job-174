"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { AddressInput } from "@scaffold-ui/components";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract, useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const CRED_TYPES = [
  { label: "VAULT", value: 0 },
  { label: "MEMBERSHIP", value: 1 },
  { label: "CREDENTIAL", value: 2 },
  { label: "PASS", value: 3 },
  { label: "RECEIPT", value: 4 },
  { label: "DOCUMENT", value: 5 },
];

// Fallback prices if contract not deployed
const DEFAULT_CLAWD_PRICE = BigInt("25000000000000000000000"); // 25000 * 10^18
const DEFAULT_USDC_PRICE = BigInt("2500000"); // 2.50 USDC

type PaymentMethod = "CLAWD" | "USDC";

const CreatePage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CLAWD");
  const [credType, setCredType] = useState(0);
  const [metadataURI, setMetadataURI] = useState("");
  const [encryptedPayloadRef, setEncryptedPayloadRef] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [recoveryWallet, setRecoveryWallet] = useState("");
  const [issuer, setIssuer] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("1");
  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

  const isOnBase = chainId === base.id;

  // Get VaultIDV3 contract address for token approvals
  const { data: vaultIDV3Info } = useDeployedContractInfo({ contractName: "VaultIDV3" });
  const vaultIDV3Address = vaultIDV3Info?.address ?? "0x0000000000000000000000000000000000000000";

  // Read mint prices
  const { data: clawdPriceRaw } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "mintPriceCLAWD",
  });

  const { data: usdcPriceRaw } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "mintPriceUSDC",
  });

  const clawdPrice = (clawdPriceRaw as bigint | undefined) ?? DEFAULT_CLAWD_PRICE;
  const usdcPrice = (usdcPriceRaw as bigint | undefined) ?? DEFAULT_USDC_PRICE;

  // Read user balances
  const { data: clawdBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    chainId: base.id,
  });

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    chainId: base.id,
  });

  // Read token allowances for VaultIDV3 as spender
  const { data: clawdAllowance, refetch: refetchClawdAllowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, vaultIDV3Address as `0x${string}`],
    chainId: base.id,
  });

  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, vaultIDV3Address as `0x${string}`],
    chainId: base.id,
  });

  // Write hooks
  const { writeContractAsync: approveClawd } = useScaffoldWriteContract({ contractName: "CLAWD" });
  const { writeContractAsync: approveUsdc } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: mintWithCLAWD } = useScaffoldWriteContract({ contractName: "VaultIDV3" });
  const { writeContractAsync: mintWithUSDC } = useScaffoldWriteContract({ contractName: "VaultIDV3" });

  const currentPrice = paymentMethod === "CLAWD" ? clawdPrice : usdcPrice;
  const currentAllowance = (paymentMethod === "CLAWD"
    ? (clawdAllowance as bigint | undefined)
    : (usdcAllowance as bigint | undefined)) ?? 0n;
  const needsApproval = currentAllowance < currentPrice;

  const getExpiryTimestamp = () => {
    if (!expiryDate) return 0n;
    return BigInt(Math.floor(new Date(expiryDate).getTime() / 1000));
  };

  const getMintParams = () => ({
    credType: credType,
    issuer: (issuer || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    encryptedPayloadRef: encryptedPayloadRef,
    metadataURI: metadataURI,
    expiry: getExpiryTimestamp(),
    recoveryWallet: (recoveryWallet || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    schemaVersion: BigInt(schemaVersion || "1"),
  });

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      if (paymentMethod === "CLAWD") {
        await approveClawd({
          functionName: "approve",
          args: [vaultIDV3Address as `0x${string}`, clawdPrice],
        });
        await refetchClawdAllowance();
      } else {
        await approveUsdc({
          functionName: "approve",
          args: [vaultIDV3Address as `0x${string}`, usdcPrice],
        });
        await refetchUsdcAllowance();
      }
      notification.success("Approval confirmed");
    } catch (e: any) {
      notification.error(e?.message ?? "Approval failed");
    } finally {
      setIsApproving(false);
    }
  };

  const handleMint = async () => {
    if (!metadataURI) {
      notification.error("Metadata URI is required");
      return;
    }
    setIsMinting(true);
    try {
      const params = getMintParams();
      if (paymentMethod === "CLAWD") {
        await mintWithCLAWD({ functionName: "mintWithCLAWD", args: [params] });
      } else {
        await mintWithUSDC({ functionName: "mintWithUSDC", args: [params] });
      }
      notification.success("Vault minted successfully!");
      // In a real app we'd parse the Transfer event for tokenId
      setMintedTokenId("(see transaction for token ID)");
    } catch (e: any) {
      notification.error(e?.message ?? "Mint failed");
    } finally {
      setIsMinting(false);
    }
  };

  // Render the primary action button
  const renderActionButton = () => {
    if (!isConnected) {
      return <RainbowKitCustomConnectButton />;
    }
    if (!isOnBase) {
      return (
        <button
          className="btn btn-warning w-full"
          onClick={() => switchChain({ chainId: base.id })}
        >
          Switch to Base
        </button>
      );
    }
    if (needsApproval) {
      return (
        <button className="btn btn-secondary w-full" onClick={handleApprove} disabled={isApproving}>
          {isApproving && <span className="loading loading-spinner loading-sm" />}
          Approve {paymentMethod}
        </button>
      );
    }
    return (
      <button className="btn btn-primary w-full" onClick={handleMint} disabled={isMinting}>
        {isMinting && <span className="loading loading-spinner loading-sm" />}
        Mint Vault
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-2">Create Vault</h1>
        <p className="opacity-60 text-sm mb-8">
          Mint a wallet-bound encrypted credential vault on Base.
        </p>

        {mintedTokenId && (
          <div className="alert alert-success mb-6">
            <span>Vault minted! {mintedTokenId}</span>
          </div>
        )}

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-6">
            {/* Payment method tabs */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Payment Method</span>
              </label>
              <div className="tabs tabs-boxed">
                <button
                  className={`tab ${paymentMethod === "CLAWD" ? "tab-active" : ""}`}
                  onClick={() => setPaymentMethod("CLAWD")}
                >
                  CLAWD
                </button>
                <button
                  className={`tab ${paymentMethod === "USDC" ? "tab-active" : ""}`}
                  onClick={() => setPaymentMethod("USDC")}
                >
                  USDC
                </button>
              </div>
            </div>

            {/* Price and balance info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="stat bg-base-200 rounded-box p-3">
                <div className="stat-title text-xs">CLAWD Price</div>
                <div className="stat-value text-sm font-mono">
                  {formatUnits(clawdPrice, 18)} CLAWD
                </div>
              </div>
              <div className="stat bg-base-200 rounded-box p-3">
                <div className="stat-title text-xs">USDC Price</div>
                <div className="stat-value text-sm font-mono">
                  ${formatUnits(usdcPrice, 6)} USDC
                </div>
              </div>
            </div>

            {isConnected && (
              <div className="grid grid-cols-2 gap-4">
                <div className="stat bg-base-200 rounded-box p-3">
                  <div className="stat-title text-xs">Your CLAWD</div>
                  <div className="stat-value text-sm font-mono">
                    {clawdBalance !== undefined
                      ? Number(formatUnits(clawdBalance as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
                <div className="stat bg-base-200 rounded-box p-3">
                  <div className="stat-title text-xs">Your USDC</div>
                  <div className="stat-value text-sm font-mono">
                    {usdcBalance !== undefined
                      ? `$${Number(formatUnits(usdcBalance as bigint, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            <div className="divider my-0" />

            {/* Credential type */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Credential Type</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={credType}
                onChange={e => setCredType(Number(e.target.value))}
              >
                {CRED_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>

            {/* Metadata URI */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Metadata URI <span className="text-error">*</span></span>
              </label>
              <input
                type="text"
                placeholder="ipfs://... or https://..."
                className="input input-bordered w-full"
                value={metadataURI}
                onChange={e => setMetadataURI(e.target.value)}
              />
            </div>

            {/* Encrypted Payload Ref */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Encrypted Payload Ref</span>
                <span className="label-text-alt opacity-50">stored on-chain, private</span>
              </label>
              <input
                type="text"
                placeholder="Encrypted reference string (e.g. IPFS CID or encrypted URL)"
                className="input input-bordered w-full font-mono text-sm"
                value={encryptedPayloadRef}
                onChange={e => setEncryptedPayloadRef(e.target.value)}
              />
            </div>

            {/* Expiry */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Expiry Date</span>
                <span className="label-text-alt opacity-50">leave blank for no expiry</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Recovery Wallet */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Recovery Wallet</span>
                <span className="label-text-alt opacity-50">optional</span>
              </label>
              <AddressInput
                placeholder="0x..."
                value={recoveryWallet}
                onChange={setRecoveryWallet}
              />
            </div>

            {/* Issuer */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Issuer Address</span>
                <span className="label-text-alt opacity-50">optional</span>
              </label>
              <AddressInput
                placeholder="0x..."
                value={issuer}
                onChange={setIssuer}
              />
            </div>

            {/* Schema Version */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">Schema Version</span>
              </label>
              <input
                type="number"
                min="1"
                className="input input-bordered w-full"
                value={schemaVersion}
                onChange={e => setSchemaVersion(e.target.value)}
              />
            </div>

            {/* Allowance status */}
            {isConnected && isOnBase && (
              <div className={`alert ${needsApproval ? "alert-warning" : "alert-success"} py-2`}>
                <span className="text-sm">
                  {needsApproval
                    ? `Approve ${paymentMethod} spend before minting`
                    : `${paymentMethod} allowance sufficient`}
                </span>
              </div>
            )}

            {/* Action button */}
            <div className="card-actions">
              {renderActionButton()}
            </div>

            <p className="text-xs opacity-40 text-center">
              VaultIDV3 not yet deployed to mainnet. Transactions will fail gracefully.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
