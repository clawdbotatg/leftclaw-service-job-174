"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AddressInput } from "@scaffold-ui/components";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { ShieldExclamationIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const AdminPage: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  // Owner state
  const [newClawdPrice, setNewClawdPrice] = useState("");
  const [newUsdcPrice, setNewUsdcPrice] = useState("");
  const [newFeeRecipient, setNewFeeRecipient] = useState("");

  // Issuer registry state
  const [issuerAddress, setIssuerAddress] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [verifyIssuerAddress, setVerifyIssuerAddress] = useState("");
  const [deactivateIssuerAddress, setDeactivateIssuerAddress] = useState("");
  const [reactivateIssuerAddress, setReactivateIssuerAddress] = useState("");

  // Loading states
  const [isSettingPrices, setIsSettingPrices] = useState(false);
  const [isSettingFeeRecipient, setIsSettingFeeRecipient] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const { data: ownerAddress } = useScaffoldReadContract({
    contractName: "VaultIDV3",
    functionName: "owner",
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "VaultIDV3" });

  const isOwner =
    connectedAddress &&
    ownerAddress &&
    connectedAddress.toLowerCase() === (ownerAddress as string).toLowerCase();

  const handleSetPrices = async () => {
    if (!newClawdPrice && !newUsdcPrice) {
      notification.error("Enter at least one price to update");
      return;
    }
    setIsSettingPrices(true);
    try {
      const clawdBig = newClawdPrice
        ? parseUnits(newClawdPrice, 18)
        : BigInt("25000000000000000000000");
      const usdcBig = newUsdcPrice
        ? parseUnits(newUsdcPrice, 6)
        : BigInt("2500000");
      await writeContractAsync({
        functionName: "setMintPrices",
        args: [clawdBig, usdcBig],
      });
      notification.success("Mint prices updated");
      setNewClawdPrice("");
      setNewUsdcPrice("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to set prices");
    } finally {
      setIsSettingPrices(false);
    }
  };

  const handleSetFeeRecipient = async () => {
    if (!newFeeRecipient) {
      notification.error("Enter a fee recipient address");
      return;
    }
    setIsSettingFeeRecipient(true);
    try {
      await writeContractAsync({
        functionName: "setFeeRecipient",
        args: [newFeeRecipient as `0x${string}`],
      });
      notification.success("Fee recipient updated");
      setNewFeeRecipient("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to set fee recipient");
    } finally {
      setIsSettingFeeRecipient(false);
    }
  };

  const handleRegisterIssuer = async () => {
    if (!issuerAddress || !issuerName) {
      notification.error("Address and name are required");
      return;
    }
    setIsRegistering(true);
    try {
      await writeContractAsync({
        functionName: "registerIssuer",
        args: [issuerAddress as `0x${string}`, issuerName],
      });
      notification.success(`Issuer ${issuerName} registered`);
      setIssuerAddress("");
      setIssuerName("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to register issuer");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerifyIssuer = async () => {
    if (!verifyIssuerAddress) {
      notification.error("Enter an issuer address");
      return;
    }
    setIsVerifying(true);
    try {
      await writeContractAsync({
        functionName: "verifyIssuer",
        args: [verifyIssuerAddress as `0x${string}`],
      });
      notification.success("Issuer verified");
      setVerifyIssuerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to verify issuer");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeactivateIssuer = async () => {
    if (!deactivateIssuerAddress) {
      notification.error("Enter an issuer address");
      return;
    }
    setIsDeactivating(true);
    try {
      await writeContractAsync({
        functionName: "deactivateIssuer",
        args: [deactivateIssuerAddress as `0x${string}`],
      });
      notification.success("Issuer deactivated");
      setDeactivateIssuerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to deactivate issuer");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateIssuer = async () => {
    if (!reactivateIssuerAddress) {
      notification.error("Enter an issuer address");
      return;
    }
    setIsReactivating(true);
    try {
      await writeContractAsync({
        functionName: "reactivateIssuer",
        args: [reactivateIssuerAddress as `0x${string}`],
      });
      notification.success("Issuer reactivated");
      setReactivateIssuerAddress("");
    } catch (e: any) {
      notification.error(e?.message ?? "Failed to reactivate issuer");
    } finally {
      setIsReactivating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center py-20 px-4 gap-4">
        <Cog6ToothIcon className="h-12 w-12 opacity-30" />
        <p className="opacity-60">Connect your wallet to access admin controls.</p>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  if (!isOwner && ownerAddress) {
    return (
      <div className="flex flex-col items-center py-20 px-4">
        <div className="alert alert-error max-w-md">
          <ShieldExclamationIcon className="h-5 w-5" />
          <div>
            <div className="font-semibold">Owner Only</div>
            <div className="text-sm opacity-70">
              This page is restricted to the VaultIDV3 contract owner.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ownerAddress) {
    return (
      <div className="flex flex-col items-center py-20 px-4">
        <div className="alert alert-warning max-w-md">
          <span>VaultIDV3 contract is not yet deployed. Admin controls unavailable.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Cog6ToothIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="opacity-60 text-sm">VaultIDV3 owner controls</p>
          </div>
        </div>

        <div className="grid gap-4">
          {/* Mint Prices */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg">Mint Prices</h2>
              <div>
                <label className="label">
                  <span className="label-text text-sm">CLAWD Price (in CLAWD, 18 decimals)</span>
                </label>
                <input
                  type="number"
                  placeholder="25000"
                  className="input input-bordered w-full"
                  value={newClawdPrice}
                  onChange={e => setNewClawdPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-sm">USDC Price (in USDC, e.g. 2.50)</span>
                </label>
                <input
                  type="number"
                  placeholder="2.50"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={newUsdcPrice}
                  onChange={e => setNewUsdcPrice(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSetPrices}
                disabled={isSettingPrices}
              >
                {isSettingPrices && <span className="loading loading-spinner loading-sm" />}
                Set Mint Prices
              </button>
            </div>
          </div>

          {/* Fee Recipient */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg">Fee Recipient</h2>
              <AddressInput
                placeholder="0x..."
                value={newFeeRecipient}
                onChange={setNewFeeRecipient}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSetFeeRecipient}
                disabled={isSettingFeeRecipient || !newFeeRecipient}
              >
                {isSettingFeeRecipient && <span className="loading loading-spinner loading-sm" />}
                Set Fee Recipient
              </button>
            </div>
          </div>

          {/* Issuer Registry */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg">Issuer Registry</h2>

              {/* Register Issuer */}
              <div className="border border-base-300 rounded-box p-4 gap-3 flex flex-col">
                <div className="font-semibold text-sm">Register Issuer</div>
                <AddressInput
                  placeholder="Issuer address (0x...)"
                  value={issuerAddress}
                  onChange={setIssuerAddress}
                />
                <input
                  type="text"
                  placeholder="Issuer name (e.g. Acme Corp)"
                  className="input input-bordered w-full input-sm"
                  value={issuerName}
                  onChange={e => setIssuerName(e.target.value)}
                />
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleRegisterIssuer}
                  disabled={isRegistering || !issuerAddress || !issuerName}
                >
                  {isRegistering && <span className="loading loading-spinner loading-sm" />}
                  Register Issuer
                </button>
              </div>

              {/* Verify Issuer */}
              <div className="border border-base-300 rounded-box p-4 gap-3 flex flex-col">
                <div className="font-semibold text-sm">Verify Issuer</div>
                <AddressInput
                  placeholder="Issuer address (0x...)"
                  value={verifyIssuerAddress}
                  onChange={setVerifyIssuerAddress}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleVerifyIssuer}
                  disabled={isVerifying || !verifyIssuerAddress}
                >
                  {isVerifying && <span className="loading loading-spinner loading-sm" />}
                  Verify Issuer
                </button>
              </div>

              {/* Deactivate Issuer */}
              <div className="border border-base-300 rounded-box p-4 gap-3 flex flex-col">
                <div className="font-semibold text-sm">Deactivate Issuer</div>
                <AddressInput
                  placeholder="Issuer address (0x...)"
                  value={deactivateIssuerAddress}
                  onChange={setDeactivateIssuerAddress}
                />
                <button
                  className="btn btn-warning btn-sm"
                  onClick={handleDeactivateIssuer}
                  disabled={isDeactivating || !deactivateIssuerAddress}
                >
                  {isDeactivating && <span className="loading loading-spinner loading-sm" />}
                  Deactivate Issuer
                </button>
              </div>

              {/* Reactivate Issuer */}
              <div className="border border-base-300 rounded-box p-4 gap-3 flex flex-col">
                <div className="font-semibold text-sm">Reactivate Issuer</div>
                <AddressInput
                  placeholder="Issuer address (0x...)"
                  value={reactivateIssuerAddress}
                  onChange={setReactivateIssuerAddress}
                />
                <button
                  className="btn btn-success btn-sm btn-outline"
                  onClick={handleReactivateIssuer}
                  disabled={isReactivating || !reactivateIssuerAddress}
                >
                  {isReactivating && <span className="loading loading-spinner loading-sm" />}
                  Reactivate Issuer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
