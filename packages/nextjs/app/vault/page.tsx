"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ShieldCheckIcon, ShieldExclamationIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const CRED_TYPE_LABELS = ["VAULT", "MEMBERSHIP", "CREDENTIAL", "PASS", "RECEIPT", "DOCUMENT"];

const formatExpiry = (expiry: bigint) => {
  if (expiry === 0n) return "No expiry";
  return new Date(Number(expiry) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const VaultDetailContent = () => {
  const searchParams = useSearchParams();
  const tokenId = searchParams.get("tokenId") ?? "";
  const tokenIdBigInt = tokenId ? BigInt(tokenId) : undefined;

  const { address: connectedAddress } = useAccount();

  const { data: vault, isLoading: vaultLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "getVault",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { data: isValid, isLoading: validLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "isValidVault",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { data: ownerAddress } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "ownerOf",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { data: isViewer } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "isViewer",
    args: [tokenIdBigInt!, connectedAddress as `0x${string}`],
    query: { enabled: !!tokenIdBigInt && !!connectedAddress },
  });

  const isOwner =
    connectedAddress &&
    ownerAddress &&
    connectedAddress.toLowerCase() === (ownerAddress as string).toLowerCase();

  const isLoading = vaultLoading || validLoading;

  if (!tokenId) {
    return (
      <div className="flex flex-col items-center py-20 px-4">
        <div className="alert alert-warning max-w-md">
          <ShieldExclamationIcon className="h-5 w-5" />
          <span>No token ID provided. Use <code>?tokenId=0</code> in the URL.</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!vault && !isLoading) {
    return (
      <div className="flex flex-col items-center py-20 px-4">
        <div className="alert alert-warning max-w-md">
          <ShieldExclamationIcon className="h-5 w-5" />
          <span>Vault #{tokenId} not found. VaultIDV3 may not yet be deployed to this network.</span>
        </div>
      </div>
    );
  }

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

  const isExpired =
    vaultData && vaultData.expiry !== 0n && vaultData.expiry < BigInt(Math.floor(Date.now() / 1000));

  const getValidityBadge = () => {
    if (vaultData?.revoked) return <span className="badge badge-error badge-lg">REVOKED</span>;
    if (isExpired) return <span className="badge badge-warning badge-lg">EXPIRED</span>;
    if (isValid) return <span className="badge badge-success badge-lg">VALID</span>;
    return <span className="badge badge-ghost badge-lg">UNKNOWN</span>;
  };

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Vault #{tokenId}</h1>
            <p className="opacity-60 text-sm mt-1">VaultID credential token</p>
          </div>
          {getValidityBadge()}
        </div>

        {isViewer && !isOwner && (
          <div className="alert alert-info mb-4">
            <ShieldCheckIcon className="h-4 w-4" />
            <span className="text-sm">You have viewer access to this Vault</span>
          </div>
        )}

        {isOwner && (
          <div className="alert alert-success mb-4">
            <ShieldCheckIcon className="h-4 w-4" />
            <div className="flex items-center justify-between w-full">
              <span className="text-sm">You own this Vault</span>
              <Link href={`/vault/manage?tokenId=${tokenId}`} className="btn btn-sm btn-ghost">
                Manage
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg">Credential Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs opacity-50 mb-1">Type</div>
                  <span className="badge badge-outline font-mono">
                    {vaultData ? CRED_TYPE_LABELS[vaultData.credType] ?? `TYPE_${vaultData.credType}` : "—"}
                  </span>
                </div>
                <div>
                  <div className="text-xs opacity-50 mb-1">Schema Version</div>
                  <span className="font-mono text-sm">
                    {vaultData ? `v${vaultData.schemaVersion.toString()}` : "—"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs opacity-50 mb-1">Expiry</div>
                <span className="text-sm">
                  {vaultData ? formatExpiry(vaultData.expiry) : "—"}
                  {isExpired && <span className="badge badge-warning badge-sm ml-2">Expired</span>}
                </span>
              </div>
              {vaultData && (
                <div>
                  <div className="text-xs opacity-50 mb-1">Issuer</div>
                  <Address address={vaultData.issuer} />
                </div>
              )}
              {vaultData && ownerAddress && (
                <div>
                  <div className="text-xs opacity-50 mb-1">Owner</div>
                  <Address address={ownerAddress as `0x${string}`} />
                </div>
              )}
              {vaultData && vaultData.recoveryWallet !== "0x0000000000000000000000000000000000000000" && (
                <div>
                  <div className="text-xs opacity-50 mb-1">Recovery Wallet</div>
                  <Address address={vaultData.recoveryWallet} />
                </div>
              )}
            </div>
          </div>

          {vaultData?.metadataURI && (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-2">
                <h2 className="card-title text-lg">Public Metadata</h2>
                <a
                  href={vaultData.metadataURI}
                  target="_blank"
                  rel="noreferrer"
                  className="link link-primary text-sm break-all font-mono"
                >
                  {vaultData.metadataURI}
                </a>
              </div>
            </div>
          )}

          <div className="card bg-base-200 shadow-sm border border-base-300">
            <div className="card-body flex-row items-center gap-4">
              <LockClosedIcon className="h-8 w-8 opacity-40 shrink-0" />
              <div>
                <div className="font-semibold text-sm">Private Encrypted Payload</div>
                <div className="text-xs opacity-60 mt-1">
                  {connectedAddress
                    ? "Use the VaultID decryption SDK to access your private payload client-side."
                    : "Connect wallet to decrypt your private payload."}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm opacity-60">
            <Link href={`/verify?tokenId=${tokenId}`} className="link link-hover">
              Public verification page
            </Link>
            <a
              href={`https://basescan.org/token/0xe03ae28c814058fa0747b3644f8e1e4314cd7eb0?a=${tokenId}`}
              target="_blank"
              rel="noreferrer"
              className="link link-hover"
            >
              View on Basescan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const VaultDetailPage: NextPage = () => (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>}>
    <VaultDetailContent />
  </Suspense>
);

export default VaultDetailPage;
