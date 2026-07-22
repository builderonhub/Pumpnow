// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMemeToken} from "../interfaces/IMemeToken.sol";
import {ReentrancyGuard} from "../security/ReentrancyGuard.sol";

contract PumpDexPool is ReentrancyGuard {
    error InvalidAddress();
    error InvalidFee();
    error ZeroAmount();
    error InsufficientOutput();
    error InsufficientLiquidity();
    error TransferFailed();
    error AlreadyInitialized();

    uint256 public constant BPS_DENOMINATOR = 10_000;
    address public immutable token;
    address public immutable factory;
    uint16 public immutable feeBps;
    uint256 public tokenReserve;
    uint256 public nativeReserve;
    uint256 public totalLiquidity;
    mapping(address account => uint256 shares) public liquidityOf;

    event LiquidityAdded(
        address indexed provider,
        address indexed recipient,
        uint256 tokenAmount,
        uint256 nativeAmount,
        uint256 liquidity
    );
    event Swap(
        address indexed sender,
        address indexed recipient,
        address indexed token,
        bool nativeToToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 tokenReserve,
        uint256 nativeReserve
    );

    constructor(address token_, uint16 feeBps_) {
        if (token_ == address(0)) revert InvalidAddress();
        if (feeBps_ > 1_000) revert InvalidFee();
        token = token_;
        feeBps = feeBps_;
        factory = msg.sender;
    }

    function addLiquidity(uint256 tokenAmount, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 liquidity)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (tokenAmount == 0 || msg.value == 0) revert ZeroAmount();
        if (totalLiquidity != 0) revert AlreadyInitialized();
        if (!IMemeToken(token).transferFrom(msg.sender, address(this), tokenAmount)) revert TransferFailed();

        liquidity = _sqrt(tokenAmount * msg.value);
        if (liquidity == 0) revert InsufficientLiquidity();

        tokenReserve += tokenAmount;
        nativeReserve += msg.value;
        totalLiquidity += liquidity;
        liquidityOf[recipient] += liquidity;
        emit LiquidityAdded(msg.sender, recipient, tokenAmount, msg.value, liquidity);
    }

    function swapNativeForToken(uint256 minTokenOutput, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 tokenOutput)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert ZeroAmount();
        uint256 fee = msg.value * feeBps / BPS_DENOMINATOR;
        uint256 effectiveInput = msg.value - fee;
        tokenOutput = tokenReserve * effectiveInput / (nativeReserve + effectiveInput);
        if (tokenOutput < minTokenOutput || tokenOutput == 0 || tokenOutput >= tokenReserve) {
            revert InsufficientOutput();
        }

        nativeReserve += msg.value;
        tokenReserve -= tokenOutput;
        if (!IMemeToken(token).transfer(recipient, tokenOutput)) revert TransferFailed();
        emit Swap(msg.sender, recipient, token, true, msg.value, tokenOutput, fee, tokenReserve, nativeReserve);
    }

    function swapTokenForNative(uint256 tokenInput, uint256 minNativeOutput, address payable recipient)
        external
        nonReentrant
        returns (uint256 nativeOutput)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (tokenInput == 0) revert ZeroAmount();
        uint256 fee = tokenInput * feeBps / BPS_DENOMINATOR;
        uint256 effectiveInput = tokenInput - fee;
        nativeOutput = nativeReserve * effectiveInput / (tokenReserve + effectiveInput);
        if (nativeOutput < minNativeOutput || nativeOutput == 0 || nativeOutput >= nativeReserve) {
            revert InsufficientOutput();
        }
        if (!IMemeToken(token).transferFrom(msg.sender, address(this), tokenInput)) revert TransferFailed();

        tokenReserve += tokenInput;
        nativeReserve -= nativeOutput;
        (bool sent,) = recipient.call{value: nativeOutput}("");
        if (!sent) revert TransferFailed();
        emit Swap(msg.sender, recipient, token, false, tokenInput, nativeOutput, fee, tokenReserve, nativeReserve);
    }

    function quoteNativeForToken(uint256 nativeInput) external view returns (uint256) {
        uint256 effectiveInput = nativeInput - nativeInput * feeBps / BPS_DENOMINATOR;
        return tokenReserve * effectiveInput / (nativeReserve + effectiveInput);
    }

    function quoteTokenForNative(uint256 tokenInput) external view returns (uint256) {
        uint256 effectiveInput = tokenInput - tokenInput * feeBps / BPS_DENOMINATOR;
        return nativeReserve * effectiveInput / (tokenReserve + effectiveInput);
    }

    function _sqrt(uint256 value) private pure returns (uint256 result) {
        if (value == 0) return 0;
        result = value;
        uint256 estimate = value / 2 + 1;
        while (estimate < result) {
            result = estimate;
            estimate = (value / estimate + estimate) / 2;
        }
    }
}
