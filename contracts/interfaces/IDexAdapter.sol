// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Boundary between PumpNow graduation and the target DEX.
/// @dev Public production deployments MUST use an audited adapter. The
/// MockDexAdapter in mocks/ is only suitable for local acceptance.
interface IDexAdapter {
    function addLiquidity(address token, uint256 tokenAmount, address recipient)
        external
        payable
        returns (bytes32 positionId);
}
