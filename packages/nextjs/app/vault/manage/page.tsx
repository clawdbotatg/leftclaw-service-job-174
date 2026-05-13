"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { AddressInput } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ShieldExclamationIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const formatExpiry = (expiry: bigint) => {
  if (expiry === 0n) return "No expiry";
  return new Date(Number(expiry) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const VaultManageContent = () => {
  const searchParams = useSearchParams();
  const tokenId = searchParams.get("tokenId") ?? "";
  const tokenIdBigInt = tokenId ? BigInt(tokenId) : undefined;

  const { address: connectedAddress } = useAccount();

  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [newRecoveryWallet, setNewRecoveryWallet] = useState("");
  const [viewerAddress, setViewerAddress] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

  const [isExtending, setIsExtending] = useState(false);
  const [isSettingRecovery, setIsSettingRecovery] = useState(false);
  const [isGrantingViewer, setIsGrantingViewer] = useState(false);
  const [isRevokingViewer, setIsRevokingViewer] = useState(false);
  const [isInvitingSigner, setIsInvitingSigner] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const { data: vault, isLoading: vaultLoading, refetch: refetchVault } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "getVault",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { data: ownerAddress, isLoading: ownerLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "ownerOf",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "VaultIDV3" });

  const isOwner =
    connectedAddress &&
    ownerAddress &&
    connectedAddress.toLowerCase() === (ownerAddress as string).toLowerCase();

  const isLoading = vaultLoading || ownerLoading;

  const vaultData = vault as {
    recoveryWallet: `0x${string}`;
    expiry: bigint;
    revoked: boolean;
    credType: number;
    issuer: `0x${string}`;
    encryptedPayloadRef: string;
    metadataURI: string;
    schemaVersion: bigint;
  } | undefined;

  const handleRevokeToggle = async () => {
    setIsToggling(true);
    try {
      if (vaultData?.revoked) {
        await writeContractAsync({ functionName: "unrevokeVault", args: [tokenIdBigInt!] });
        notification.success("Vault unrevoked");
      } else {
        await writeContractAsync({ functionName: "revokeVault", args: [tokenIdBigInt!] });
        notification.success("Vault revoked");
      }
      await refetchVault();
    } catch (e: any) {
      notification.error(e?.message ?? "Operation failed");
    } finally {
      setIsToggling(false);
    }
  };

  const handleExtendExpiry = async () => {
    if (!newExpiryDate) {
      notification.error("Please select a new expiry date");
      return;
    }
    const newExpiry = BigInt(Math.floor(new Date(newExpiryDate).getTime() / 1000));
    setIsExtending(true);
    try {
      await writeContractAsync({ functionName: "extendExpiry", args: [tokenIdBigInt!, newExpiry] });
      notification.success("Expiry extended");
      setNewExpiryDate("");
      await refetchVault();
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to extend expiry");
    } finally {
      setIsExtending(false);
    }
  };

  const handleSetRecoveryWallet = async () => {
    if (!newRecoveryWallet) {
      notification.error("Please enter a wallet address");
      return;
    }
    setIsSettingRecovery(true);
    try {
      await writeContractAsync({
        functionName: "setRecoveryWallet",
        args: [tokenIdBigInt!, newRecoveryWallet as `0x${string}`],
      });
      notification.success("Recovery wallet updated");
      setNewRecoveryWallet("");
      await refetchVault();
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to set recovery wallet");
    } finally {
      setIsSettingRecovery(false);
    }
  };

  const handleGrantViewer = async () => {
    if (!viewerAddress) {
      notification.error("Please enter an address");
      return;
    }
    setIsGrantingViewer(true);
    try {
      await writeContractAsync({
        functionName: "grantViewerPermission",
        args: [tokenIdBigInt!, viewerAddress as `0x${string}`],
      });
      notification.success("Viewer permission granted");
      setViewerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to grant viewer permission");
    } finally {
      setIsGrantingViewer(false);
    }
  };

  const handleRevokeViewer = async () => {
    if (!viewerAddress) {
      notification.error("Please enter an address");
      return;
    }
    setIsRevokingViewer(true);
    try {
      await writeContractAsync({
        functionName: "revokeViewerPermission",
        args: [tokenIdBigInt!, viewerAddress as `0x${string}`],
      });
      notification.success("Viewer permission revoked");
      setViewerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to revoke viewer permission");
    } finally {
      setIsRevokingViewer(false);
    }
  };

  const handleInviteSigner = async () => {
    if (!signerAddress) {
      notification.error("Please enter an address");
      return;
    }
    setIsInvitingSigner(true);
    try {
      await writeContractAsync({
        functionName: "inviteSigner",
        args: [tokenIdBigInt!, signerAddress as `0x${string}`],
      });
      notification.success("Signer invited (event emitted)");
      setSignerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to invite signer");
    } finally {
      setIsInvitingSigner(false);
    }
  };

  const handleBurn = async () => {
    setIsBurning(true);
    try {
      await writeContractAsync({ functionName: "burnVault", args: [tokenIdBigInt!] });
      notification.success("Vault burned");
      setShowBurnConfirm(false);
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to burn vault");
    } finally {
      setIsBurning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center py-20 px-4">
        <div className="alert alert-error max-w-md">
          <ShieldExclamationIcon className="h-5 w-5" />
          <span>
            {connectedAddress
              ? "You are not the owner of this Vault."
              : "Connect your wallet to manage this Vault."}
          </span>
        </div>
        <Link href={`/vault?tokenId=${tokenId}`} className="btn btn-ghost mt-4 gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Vault
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/vault?tokenId=${tokenId}`} className="btn btn-ghost btn-sm gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Manage Vault #{tokenId}</h1>
            <p className="opacity-60 text-sm">Owner controls</p>
          </div>
        </div>

        <div className="grid gap-4">
          {/* Revoke / Unrevoke */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">Revocation Status</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-70">Current status:</div>
                  {vaultData?.revoked
                    ? <span className="badge badge-error mt-1">REVOKED</span>
                    : <span className="badge badge-success mt-1">ACTIVE</span>}
                </div>
                <button
                  className={`btn ${vaultData?.revoked ? "btn-success" : "btn-error"} btn-sm`}
                  onClick={handleRevokeToggle}
                  disabled={isToggling}
                >
                  {isToggling && <span className="loading loading-spinner loading-sm" />}
                  {vaultData?.revoked ? "Unrevoke Vault" : "Revoke Vault"}
                </button>
              </div>
            </div>
          </div>

          {/* Extend Expiry */}
          {vaultData && vaultData.expiry !== 0n && (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-3">
                <h2 className="card-title text-lg">Extend Expiry</h2>
                <div className="text-sm opacity-60">
                  Current expiry: <span className="font-mono">{formatExpiry(vaultData.expiry)}</span>
                </div>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={newExpiryDate}
                  onChange={e => setNewExpiryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleExtendExpiry}
                  disabled={isExtending || !newExpiryDate}
                >
                  {isExtending && <span className="loading loading-spinner loading-sm" />}
                  Extend Expiry
                </button>
              </div>
            </div>
          )}

          {/* Recovery Wallet */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg">Recovery Wallet</h2>
              <AddressInput
                placeholder="0x..."
                value={newRecoveryWallet}
                onChange={setNewRecoveryWallet}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSetRecoveryWallet}
                disabled={isSettingRecovery || !newRecoveryWallet}
              >
                {isSettingRecovery && <span className="loading loading-spinner loading-sm" />}
                Set Recovery Wallet
              </button>
            </div>
          </div>

          {/* Viewer Permissions */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg">Viewer Permissions</h2>
              <AddressInput
                placeholder="Viewer address (0x...)"
                value={viewerAddress}
                onChange={setViewerAddress}
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-success btn-sm flex-1"
                  onClick={handleGrantViewer}
                  disabled={isGrantingViewer || !viewerAddress}
                >
                  {isGrantingViewer && <span className="loading loading-spinner loading-sm" />}
                  Grant Access
                </button>
                <button
                  className="btn btn-error btn-sm btn-outline flex-1"
                  onClick={handleRevokeViewer}
                  disabled={isRevokingViewer || !viewerAddress}
                >
                  {isRevokingViewer && <span className="loading loading-spinner loading-sm" />}
                  Revoke Access
                </button>
              </div>
            </div>
          </div>

          {/* Invite Signer */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <div>
                <h2 className="card-title text-lg">Signer Invitation</h2>
                <p className="text-xs opacity-50 mt-1">
                  Event-only signal — emits an on-chain event but grants no on-chain permissions.
                </p>
              </div>
              <AddressInput
                placeholder="Signer address (0x...)"
                value={signerAddress}
                onChange={setSignerAddress}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleInviteSigner}
                disabled={isInvitingSigner || !signerAddress}
              >
                {isInvitingSigner && <span className="loading loading-spinner loading-sm" />}
                Invite Signer
              </button>
            </div>
          </div>

          {/* Burn Vault */}
          <div className="card bg-base-100 shadow-sm border border-error/30">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg text-error">Danger Zone</h2>
              <p className="text-sm opacity-60">
                Burning destroys this Vault permanently. This action cannot be undone.
              </p>
              {showBurnConfirm ? (
                <div className="flex flex-col gap-2">
                  <div className="alert alert-error py-2">
                    <span className="text-sm">Are you sure? This cannot be undone.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-error btn-sm flex-1"
                      onClick={handleBurn}
                      disabled={isBurning}
                    >
                      {isBurning && <span className="loading loading-spinner loading-sm" />}
                      Yes, Burn Vault
                    </button>
                    <button
                      className="btn btn-ghost btn-sm flex-1"
                      onClick={() => setShowBurnConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-error btn-outline btn-sm"
                  onClick={() => setShowBurnConfirm(true)}
                >
                  Burn Vault
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VaultManagePage: NextPage = () => (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>}>
    <VaultManageContent />
  </Suspense>
);

export default VaultManagePage;
