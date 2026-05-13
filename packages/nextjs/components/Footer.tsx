import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

// VaultIDV2 placeholder address (V3 not yet deployed to mainnet)
const VAULTID_V2_ADDRESS = "0xe03ae28c814058fa0747b3644f8e1e4314cd7eb0";

/**
 * Site footer
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div>
        <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <div className="flex flex-col md:flex-row gap-2 pointer-events-auto">
            {isLocalNetwork && (
              <Faucet />
            )}
          </div>
          <SwitchTheme className={`pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`} />
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-2 text-sm w-full flex-wrap">
            <span className="font-semibold">VaultID</span>
            <span className="opacity-40">—</span>
            <span className="opacity-70">Encrypted credential infrastructure on Base</span>
            <span className="opacity-40">·</span>
            <a
              href={`https://basescan.org/address/${VAULTID_V2_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="link link-hover opacity-70"
            >
              Contract on Basescan
            </a>
            <span className="opacity-40">·</span>
            <Link href="/create" className="link link-hover opacity-70">
              Create Vault
            </Link>
          </div>
        </ul>
      </div>
    </div>
  );
};
