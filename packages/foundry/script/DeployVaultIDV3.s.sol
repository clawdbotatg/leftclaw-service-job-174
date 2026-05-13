// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import "../contracts/VaultIDV3.sol";

/**
 * @notice Deploy script for VaultIDV3
 * @dev PAUSE BEFORE MAINNET DEPLOY — per client instruction.
 *      Review contract and tests before deploying to Base mainnet.
 *
 * Usage (local fork):
 *   yarn deploy --file DeployVaultIDV3.s.sol
 *
 * Usage (mainnet — requires client approval first):
 *   yarn deploy --file DeployVaultIDV3.s.sol --network base
 *
 * Deployment transfers ownership to the client wallet immediately after deploy.
 */
contract DeployVaultIDV3 is ScaffoldETHDeploy {
    // Production token addresses on Base mainnet
    address constant CLAWD_TOKEN = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
    address constant USDC_TOKEN = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // Client wallet — receives ownership of the contract
    address constant CLIENT_WALLET = 0xFE968dE21eb0E77d5877477C31a04A3075c0086E;

    // Default mint prices
    uint256 constant CLAWD_PRICE = 25_000 * 1e18; // 25,000 CLAWD (18 decimals)
    uint256 constant USDC_PRICE = 2_500_000; // 2.50 USDC (6 decimals)

    function run() external ScaffoldEthDeployerRunner {
        VaultIDV3 vault = new VaultIDV3(
            CLAWD_TOKEN,
            USDC_TOKEN,
            CLAWD_PRICE,
            USDC_PRICE,
            CLIENT_WALLET, // feeRecipient
            deployer // initial owner (will transfer below)
        );

        // Transfer ownership to client immediately
        vault.transferOwnership(CLIENT_WALLET);
        // Client must call acceptOwnership() to finalize (Ownable2Step)
    }
}
