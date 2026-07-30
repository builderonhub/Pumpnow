// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    error FeeBpsOutOfRange();

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PumpFactory factory) {
        address dexAdapter = vm.envAddress("DEX_ADAPTER_ADDRESS");
        uint256 feeBps = vm.envUint("FEE_BPS");
        uint256 basePrice = vm.envUint("BASE_PRICE");
        uint256 virtualTokenBps = vm.envUint("VIRTUAL_TOKEN_BPS");
        uint256 graduationBps = vm.envUint("GRADUATION_BPS");
        if (feeBps > type(uint16).max || virtualTokenBps > type(uint16).max || graduationBps > type(uint16).max) {
            revert FeeBpsOutOfRange();
        }

        vm.startBroadcast();
        // forge-lint: disable-next-line(unsafe-typecast)
        factory = new PumpFactory(uint16(feeBps), basePrice, uint16(virtualTokenBps), uint16(graduationBps), dexAdapter);
        vm.stopBroadcast();
    }
}
