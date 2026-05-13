"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { ShieldCheckIcon, LockClosedIcon, ArrowRightIcon, UserGroupIcon } from "@heroicons/react/24/outline";

const MembershipPage: NextPage = () => {
  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-3xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
            <UserGroupIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Membership Vaults</h1>
          <p className="text-lg opacity-70 max-w-xl mx-auto">
            Issue wallet-bound membership credentials that prove affiliation, access rights,
            or organizational membership — without revealing private details on-chain.
          </p>
          <Link
            href="/create?credType=1"
            className="btn btn-primary btn-lg mt-6 gap-2"
          >
            Mint Membership Vault
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>

        {/* What is a Membership Vault */}
        <div className="card bg-base-100 shadow-sm mb-6">
          <div className="card-body gap-4">
            <h2 className="card-title text-xl">What is a Membership Vault?</h2>
            <p className="opacity-70">
              A Membership Vault is a soul-bound NFT of type <span className="badge badge-outline font-mono badge-sm">MEMBERSHIP</span> minted
              through VaultID. It represents organizational membership, club access, subscription status,
              or any relationship-based credential.
            </p>
            <p className="opacity-70">
              The credential is non-transferable — it stays bound to the wallet that minted it.
              Private details (like member ID or tier) are stored as an encrypted payload reference
              that only the holder can decrypt.
            </p>
          </div>
        </div>

        {/* Use cases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <ShieldCheckIcon className="h-6 w-6 text-primary" />
              <h3 className="font-semibold">DAO Membership</h3>
              <p className="text-sm opacity-60">
                Prove governance rights or voting eligibility without revealing wallet history.
                Gate discord access, proposals, and multi-sig participation.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <LockClosedIcon className="h-6 w-6 text-secondary" />
              <h3 className="font-semibold">Subscription Access</h3>
              <p className="text-sm opacity-60">
                Issue timed membership credentials with expiry dates. Revoke access
                when subscriptions lapse. Gate premium content by on-chain validity check.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <UserGroupIcon className="h-6 w-6 text-accent" />
              <h3 className="font-semibold">Community Credentials</h3>
              <p className="text-sm opacity-60">
                Issue member badges to conference attendees, protocol contributors,
                or hackathon participants. Verifiable on-chain, instantly.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <ShieldCheckIcon className="h-6 w-6 text-success" />
              <h3 className="font-semibold">Identity Attestation</h3>
              <p className="text-sm opacity-60">
                Issue KYC-complete or accreditation credentials to wallets. The issuer
                attests on-chain; private data stays encrypted off-chain.
              </p>
            </div>
          </div>
        </div>

        {/* How to mint */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body gap-4">
            <h2 className="card-title text-lg">Minting a Membership Vault</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm opacity-70">
              <li>Connect your wallet on Base network</li>
              <li>Choose CLAWD or USDC as payment method</li>
              <li>Select <span className="font-mono badge badge-sm">MEMBERSHIP</span> as credential type</li>
              <li>Set a metadata URI pointing to your membership credential JSON</li>
              <li>Optionally add an encrypted payload reference for private member data</li>
              <li>Set an expiry date if the membership is time-limited</li>
              <li>Approve token spend, then mint</li>
            </ol>
          </div>
        </div>

        {/* Pricing note */}
        <div className="text-center opacity-50 text-sm mb-4">
          Membership Vaults use the same mint price as all credential types: 25,000 CLAWD or $2.50 USDC.
        </div>

        <div className="flex justify-center">
          <Link href="/create?credType=1" className="btn btn-primary gap-2">
            <ArrowRightIcon className="h-4 w-4" />
            Create Membership Vault
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MembershipPage;
