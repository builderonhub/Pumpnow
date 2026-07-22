// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ArcUniswapV3Adapter} from "../adapters/ArcUniswapV3Adapter.sol";
import {PumpFactory} from "../core/PumpFactory.sol";

interface DexDeployVm {
    function envAddress(string calldata name) external returns (address);
    function envInt(string calldata name) external returns (int256);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the real DEX boundary. It does not hard-code an unverified
/// Arc DEX address; production operators must supply addresses published by
/// the selected DEX and verify their bytecode before broadcast.
contract DeployDexReady {
    error ParameterOutOfRange();

    DexDeployVm private constant vm = DexDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ArcUniswapV3Adapter adapter, PumpFactory factory) {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address positionManager = vm.envAddress("DEX_POSITION_MANAGER_ADDRESS");
        uint256 poolFee = vm.envUint("DEX_POOL_FEE");
        int256 lower = vm.envInt("DEX_TICK_LOWER");
        int256 upper = vm.envInt("DEX_TICK_UPPER");
        uint256 sqrtPrice = vm.envUint("DEX_INITIAL_SQRT_PRICE_X96");
        uint256 feeBps = vm.envUint("FEE_BPS");
        if (
            poolFee > type(uint24).max || lower < type(int24).min || lower > type(int24).max || upper < type(int24).min
                || upper > type(int24).max || sqrtPrice > type(uint160).max || feeBps > type(uint16).max
        ) revert ParameterOutOfRange();

        vm.startBroadcast();
        adapter = new ArcUniswapV3Adapter(
            usdc, positionManager, uint24(poolFee), int24(lower), int24(upper), uint160(sqrtPrice)
        );
        factory = new PumpFactory(
            uint16(feeBps),
            vm.envUint("BASE_PRICE"),
            vm.envUint("CURVE_SLOPE"),
            vm.envUint("GRADUATION_THRESHOLD"),
            address(adapter)
        );
        adapter.setFactory(address(factory));
        vm.stopBroadcast();
    }
}
