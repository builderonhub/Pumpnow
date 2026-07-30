// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";
import {PumpDexFactory} from "../dex/PumpDexFactory.sol";
import {PumpDexAdapter} from "../adapters/PumpDexAdapter.sol";

interface PumpDexDeployVm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployPumpDexTestnet {
    error ParameterOutOfRange();

    PumpDexDeployVm private constant vm = PumpDexDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PumpDexFactory dex, PumpDexAdapter adapter, PumpFactory factory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 dexFeeBps = vm.envUint("DEX_FEE_BPS");
        uint256 tradeFeeBps = vm.envUint("FEE_BPS");
        uint256 basePrice = vm.envUint("BASE_PRICE");
        uint256 virtualTokenBps = vm.envUint("VIRTUAL_TOKEN_BPS");
        uint256 graduationBps = vm.envUint("GRADUATION_BPS");
        if (
            dexFeeBps > type(uint16).max || tradeFeeBps > type(uint16).max || virtualTokenBps > type(uint16).max
                || graduationBps > type(uint16).max
        ) revert ParameterOutOfRange();

        vm.startBroadcast(deployerKey);
        dex = new PumpDexFactory(uint16(dexFeeBps));
        adapter = new PumpDexAdapter(address(dex));
        dex.setPoolCreator(address(adapter));
        factory = new PumpFactory(
            uint16(tradeFeeBps), basePrice, uint16(virtualTokenBps), uint16(graduationBps), address(adapter)
        );
        adapter.setFactory(address(factory));
        vm.stopBroadcast();
    }
}
