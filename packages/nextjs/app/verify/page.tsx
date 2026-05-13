"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { Address } from "@scaffold-ui/components";
import { CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const CRED_TYPE_LABELS = ["VAULT", "MEMBERSHIP", "CREDENTIAL", "PASS", "RECEIPT", "DOCUMENT"];

const CONTRACT_ADDRESS = "0xe03ae28c814058fa0747b3644f8e1e4314cd7eb0";

const formatExpiry = (expiry: bigint) => {
  if (expiry === 0n) return "No expiry";
  return new Date(Number(expiry) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const VerifyContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenId = searchParams.get("tokenId") ?? "";
  const tokenIdBigInt = tokenId ? BigInt(tokenId) : undefined;

  const [searchId, setSearchId] = useState("");

  const { data: isValid, isLoading: validLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "isValidVault",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

  const { data: vault, isLoading: vaultLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "getVault",
    args: [tokenIdBigInt!],
    query: { enabled: !!tokenIdBigInt },
  });

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

  const { data: issuerInfo } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "getIssuer",
    args: [vaultData?.issuer as `0x${string}`],
    query: { enabled: !!vaultData?.issuer && vaultData.issuer !== "0x0000000000000000000000000000000000000000" },
  });

  const issuerData = issuerInfo as { name: string; verified: boolean; active: boolean } | undefined;

  const isLoading = validLoading || vaultLoading;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      router.push(`/verify?tokenId=${searchId.trim()}`);
    }
  };

  const isExpired =
    vaultData && vaultData.expiry !== 0n && vaultData.expiry < BigInt(Math.floor(Date.now() / 1000));

  const contractDeployed = !isLoading && vault !== undefined;

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Verify Credential</h1>
          <p className="opacity-60 text-sm">
            Public verification — no wallet required. Enter a Vault token ID to check its validity.
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="text"
            placeholder="Token ID (e.g. 42)"
            className="input input-bordered flex-1"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
          />
          <button type="submit" className="btn btn-primary gap-2">
            <MagnifyingGlassIcon className="h-4 w-4" />
            Verify
          </button>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!isLoading && tokenId && !contractDeployed && (
          <div className="alert alert-warning">
            <span>
              VaultIDV3 is not yet deployed on this network. Verification unavailable.
            </span>
          </div>
        )}

        {!isLoading && vaultData && (
          <>
            {/* Trust signal */}
            <div className={`card shadow-sm mb-6 ${isValid ? "bg-success/10 border border-success/30" : "bg-error/10 border border-error/30"}`}>
              <div className="card-body items-center text-center py-10 gap-4">
                {isValid ? (
                  <>
                    <CheckCircleIcon className="h-20 w-20 text-success" />
                    <div>
                      <div className="text-2xl font-bold text-success">VALID</div>
                      <div className="text-sm opacity-60 mt-1">This credential is authentic and active</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-20 w-20 text-error" />
                    <div>
                      <div className="text-2xl font-bold text-error">INVALID</div>
                      <div className="text-sm opacity-60 mt-1">
                        {vaultData.revoked ? "This credential has been revoked" : isExpired ? "This credential has expired" : "This credential is not valid"}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-2 flex-wrap justify-center">
                  {vaultData.revoked && <span className="badge badge-error">REVOKED</span>}
                  {isExpired && <span className="badge badge-warning">EXPIRED</span>}
                  <span className="badge badge-outline font-mono">
                    {CRED_TYPE_LABELS[vaultData.credType] ?? `TYPE_${vaultData.credType}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {/* Credential details */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body gap-4">
                  <h2 className="card-title text-base">Vault #{tokenId} Details</h2>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="opacity-50 text-xs mb-1">Credential Type</div>
                      <span className="badge badge-outline font-mono">
                        {CRED_TYPE_LABELS[vaultData.credType] ?? `TYPE_${vaultData.credType}`}
                      </span>
                    </div>
                    <div>
                      <div className="opacity-50 text-xs mb-1">Schema Version</div>
                      <span className="font-mono">v{vaultData.schemaVersion.toString()}</span>
                    </div>
                    <div>
                      <div className="opacity-50 text-xs mb-1">Expiry</div>
                      <span>{formatExpiry(vaultData.expiry)}</span>
                    </div>
                    <div>
                      <div className="opacity-50 text-xs mb-1">Status</div>
                      {vaultData.revoked
                        ? <span className="badge badge-error badge-sm">Revoked</span>
                        : isExpired
                        ? <span className="badge badge-warning badge-sm">Expired</span>
                        : <span className="badge badge-success badge-sm">Active</span>}
                    </div>
                  </div>

                  {vaultData.issuer !== "0x0000000000000000000000000000000000000000" && (
                    <div>
                      <div className="opacity-50 text-xs mb-1">Issuer</div>
                      <Address address={vaultData.issuer} />
                    </div>
                  )}
                </div>
              </div>

              {/* Issuer info */}
              {issuerData && vaultData.issuer !== "0x0000000000000000000000000000000000000000" && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="card-title text-base">Issuer Profile</h2>
                      {issuerData.verified && (
                        <div className="flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4 text-success" />
                          <span className="badge badge-success badge-sm">Verified</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm">
                      <div className="opacity-50 text-xs mb-1">Name</div>
                      <div className="font-semibold">{issuerData.name || "Unnamed Issuer"}</div>
                    </div>
                    <div className="text-sm">
                      <div className="opacity-50 text-xs mb-1">Status</div>
                      {issuerData.active
                        ? <span className="badge badge-success badge-sm">Active</span>
                        : <span className="badge badge-error badge-sm">Inactive</span>}
                    </div>
                    <Link href={`/issuer?address=${vaultData.issuer}`} className="link link-hover text-xs">
                      View issuer profile
                    </Link>
                  </div>
                </div>
              )}

              {/* External links */}
              <div className="flex justify-between items-center text-sm opacity-60">
                <Link href={`/vault?tokenId=${tokenId}`} className="link link-hover">
                  Full vault details
                </Link>
                <a
                  href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link link-hover"
                >
                  Contract on Basescan
                </a>
              </div>
            </div>
          </>
        )}

        {!isLoading && !vaultData && tokenId && contractDeployed && (
          <div className="alert alert-warning">
            <XCircleIcon className="h-5 w-5" />
            <span>Vault #{tokenId} does not exist or could not be read.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const VerifyPage: NextPage = () => (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>}>
    <VerifyContent />
  </Suspense>
);

export default VerifyPage;
