// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";
import {MockDexAdapter} from "../mocks/MockDexAdapter.sol";

interface TestnetVm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @dev Acceptance-only deployment. MockDexAdapter must never be used on mainnet.
contract DeployTestnet {
    error FeeBpsOutOfRange();

    TestnetVm private constant vm = TestnetVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MockDexAdapter adapter, PumpFactory factory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 feeBps = vm.envUint("FEE_BPS");
        uint256 basePrice = vm.envUint("BASE_PRICE");
        uint256 slope = vm.envUint("CURVE_SLOPE");
        uint256 graduationThreshold = vm.envUint("GRADUATION_THRESHOLD");
        if (feeBps > type(uint16).max) revert FeeBpsOutOfRange();

        vm.startBroadcast(deployerKey);
        adapter = new MockDexAdapter();
        factory = new PumpFactory(uint16(feeBps), basePrice, slope, graduationThreshold, address(adapter));
        vm.stopBroadcast();
    }
}
