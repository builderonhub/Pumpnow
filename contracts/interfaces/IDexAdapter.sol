// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDexAdapter {
    function addLiquidity(address token, uint256 tokenAmount, address recipient)
        external
        payable
        returns (bytes32 positionId);
}
