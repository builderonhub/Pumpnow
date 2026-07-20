// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function collectFee(address payer, address token, uint256 amount) external payable;
}
