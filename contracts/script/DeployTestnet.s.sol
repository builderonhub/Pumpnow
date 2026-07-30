// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";
import {MockDexAdapter} from "../mocks/MockDexAdapter.sol";

interface TestnetVm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @dev Local acceptance only. Public Arc Testnet uses DeployPumpDexTestnet.
contract DeployTestnet {
    error FeeBpsOutOfRange();

    TestnetVm private constant vm = TestnetVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MockDexAdapter adapter, PumpFactory factory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 feeBps = vm.envUint("FEE_BPS");
        uint256 basePrice = vm.envUint("BASE_PRICE");
        uint256 virtualTokenBps = vm.envUint("VIRTUAL_TOKEN_BPS");
        uint256 graduationBps = vm.envUint("GRADUATION_BPS");
        if (feeBps > type(uint16).max || virtualTokenBps > type(uint16).max || graduationBps > type(uint16).max) revert FeeBpsOutOfRange();

        vm.startBroadcast(deployerKey);
        adapter = new MockDexAdapter();
        // Safe because the explicit bound check above rejects values larger than uint16.
        // forge-lint: disable-next-line(unsafe-typecast)
        factory = new PumpFactory(uint16(feeBps), basePrice, uint16(virtualTokenBps), uint16(graduationBps), address(adapter));
        vm.stopBroadcast();
    }
}
