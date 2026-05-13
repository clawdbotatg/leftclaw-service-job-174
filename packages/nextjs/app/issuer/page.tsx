"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { Address } from "@scaffold-ui/components";
import { CheckCircleIcon, XCircleIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const IssuerContent = () => {
  const searchParams = useSearchParams();
  const address = (searchParams.get("address") ?? "") as `0x${string}`;

  const { data: issuerInfo, isLoading } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "getIssuer",
    args: [address],
    query: { enabled: !!address },
  });

  const issuerData = issuerInfo as { name: string; verified: boolean; active: boolean } | undefined;

  const isValidAddress = address && address.startsWith("0x") && address.length === 42;

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <BuildingOfficeIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Issuer Profile</h1>
            <p className="opacity-60 text-sm">Credential issuer information</p>
          </div>
        </div>

        {!isValidAddress && (
          <div className="alert alert-error">
            <XCircleIcon className="h-5 w-5" />
            <span>Invalid address format.</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!isLoading && isValidAddress && (
          <div className="grid gap-4">
            {/* Address card */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div>
                  <div className="text-xs opacity-50 mb-1">Issuer Address</div>
                  <Address address={address} />
                </div>

                {issuerData ? (
                  <>
                    <div>
                      <div className="text-xs opacity-50 mb-1">Name</div>
                      <div className="text-lg font-semibold">
                        {issuerData.name || <span className="opacity-40 italic">Unnamed Issuer</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-xs opacity-50 mb-1">Verification</div>
                        {issuerData.verified ? (
                          <div className="flex items-center gap-1">
                            <CheckCircleIcon className="h-4 w-4 text-success" />
                            <span className="badge badge-success">Verified</span>
                          </div>
                        ) : (
                          <span className="badge badge-ghost">Unverified</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs opacity-50 mb-1">Status</div>
                        {issuerData.active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-error">Inactive</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="alert alert-warning py-2">
                    <span className="text-sm">
                      This address is not registered as an issuer. VaultIDV3 may not yet be deployed,
                      or this issuer has not been registered.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Credentials issued */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-2">
                <h2 className="card-title text-base">Credentials Issued</h2>
                <div className="alert bg-base-200 py-3">
                  <span className="text-sm opacity-60">
                    Event-based credential indexing coming soon. An indexer is required to enumerate
                    all Vaults issued by this address from on-chain events.
                  </span>
                </div>
              </div>
            </div>

            {/* Register link */}
            {!issuerData && (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body gap-2">
                  <h2 className="card-title text-base">Become an Issuer</h2>
                  <p className="text-sm opacity-60">
                    Issuers are registered by the VaultID contract owner. If you want to issue
                    credentials, contact the protocol admin.
                  </p>
                  <Link href="/admin" className="btn btn-primary btn-sm w-fit">
                    Go to Admin
                  </Link>
                </div>
              </div>
            )}

            {/* External link */}
            <div className="text-right text-sm opacity-60">
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="link link-hover"
              >
                View on Basescan
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const IssuerPage: NextPage = () => (
  <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>}>
    <IssuerContent />
  </Suspense>
);

export default IssuerPage;
