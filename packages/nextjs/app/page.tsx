"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { ShieldCheckIcon, MagnifyingGlassIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "totalSupply",
  });

  const { data: totalMinted } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "totalMinted",
  });

  return (
    <div className="flex items-center flex-col grow">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center gap-6 px-5 py-20 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-2">
          <ShieldCheckIcon className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          Own Your Credentials
        </h1>
        <p className="text-xl opacity-70 max-w-xl">
          VaultID issues wallet-bound, encrypted credentials on Base. Each Vault is a non-transferable token
          containing a private encrypted payload — only you hold the key.
        </p>

        {/* Stats */}
        {(totalSupply !== undefined || totalMinted !== undefined) && (
          <div className="flex gap-8 mt-2">
            {totalSupply !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{totalSupply.toString()}</div>
                <div className="text-sm opacity-60">Active Vaults</div>
              </div>
            )}
            {totalMinted !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">{totalMinted.toString()}</div>
                <div className="text-sm opacity-60">Total Minted</div>
              </div>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          <Link href="/create" className="btn btn-primary btn-lg gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            Create Vault
          </Link>
          <Link href="/admin" className="btn btn-outline btn-lg gap-2">
            <Cog6ToothIcon className="h-5 w-5" />
            Admin
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="bg-base-200 w-full py-16 px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 opacity-80">How VaultID Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                  <ShieldCheckIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="card-title text-base">Mint a Vault</h3>
                <p className="text-sm opacity-70">
                  Pay with CLAWD or USDC to mint a soul-bound credential Vault. Set the credential type,
                  expiry, and encrypted payload reference.
                </p>
                <div className="card-actions mt-2">
                  <Link href="/create" className="btn btn-primary btn-sm">Get Started</Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mb-2">
                  <MagnifyingGlassIcon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="card-title text-base">Verify Credentials</h3>
                <p className="text-sm opacity-70">
                  Anyone can verify a Vault&apos;s validity by token ID. The public check confirms
                  authenticity without revealing private payload data.
                </p>
                <div className="card-actions mt-2">
                  <Link href="/verify/1" className="btn btn-secondary btn-sm btn-outline">Try Verify</Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-2">
                  <Cog6ToothIcon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="card-title text-base">Manage Your Vault</h3>
                <p className="text-sm opacity-70">
                  Grant viewer access, set a recovery wallet, extend expiry, or burn your Vault.
                  Full control stays with you.
                </p>
                <div className="card-actions mt-2">
                  <Link href="/membership" className="btn btn-sm btn-outline">Membership Vaults</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credential types */}
      <div className="w-full py-16 px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4 opacity-80">Credential Types</h2>
          <p className="opacity-60 mb-8 text-sm">Six credential types to cover every use case.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["VAULT", "MEMBERSHIP", "CREDENTIAL", "PASS", "RECEIPT", "DOCUMENT"].map(type => (
              <span key={type} className="badge badge-outline badge-lg font-mono">{type}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
