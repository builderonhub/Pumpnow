// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {IMemeToken} from "../interfaces/IMemeToken.sol";

/// @dev TEST-ONLY adapter. It custody-holds liquidity and does not create a
/// real DEX position. Never configure this contract for a public deployment.
contract MockDexAdapter is IDexAdapter {
    error InvalidAddress();
    error InvalidLiquidity();
    error TokenTransferFailed();

    uint256 public callCount;
    address public lastCaller;
    address public lastToken;
    address public lastRecipient;
    uint256 public lastTokenAmount;
    uint256 public lastNativeAmount;
    bytes32 public lastPositionId;

    event LiquidityAdded(
        address indexed caller,
        address indexed token,
        address indexed recipient,
        uint256 tokenAmount,
        uint256 nativeAmount,
        bytes32 positionId
    );

    function addLiquidity(address token, uint256 tokenAmount, address recipient)
        external
        payable
        returns (bytes32 positionId)
    {
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        if (tokenAmount == 0 || msg.value == 0) revert InvalidLiquidity();
        if (!IMemeToken(token).transferFrom(msg.sender, address(this), tokenAmount)) revert TokenTransferFailed();

        callCount++;
        lastCaller = msg.sender;
        lastToken = token;
        lastRecipient = recipient;
        lastTokenAmount = tokenAmount;
        lastNativeAmount = msg.value;
        positionId = keccak256(abi.encode(block.chainid, msg.sender, token, callCount));
        lastPositionId = positionId;

        emit LiquidityAdded(msg.sender, token, recipient, tokenAmount, msg.value, positionId);
    }
}
