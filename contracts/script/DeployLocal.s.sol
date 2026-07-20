// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {PumpFactory} from "../core/PumpFactory.sol";
import {MockDexAdapter} from "../mocks/MockDexAdapter.sol";

interface LocalVm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployLocal {
    LocalVm private constant vm = LocalVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MockDexAdapter adapter, PumpFactory factory) {
        uint256 deployerKey = vm.envUint("ANVIL_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        adapter = new MockDexAdapter();
        factory = new PumpFactory(100, 1e12, 1e12, 100 ether, address(adapter));
        vm.stopBroadcast();
    }
}
