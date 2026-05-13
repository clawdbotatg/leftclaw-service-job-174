//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployVaultIDV3 } from "./DeployVaultIDV3.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev PAUSE BEFORE MAINNET DEPLOY — per client instruction.
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployVaultIDV3 deployVaultIDV3 = new DeployVaultIDV3();
        deployVaultIDV3.run();
    }
}
