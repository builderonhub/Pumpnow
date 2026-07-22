// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {IMemeToken} from "../interfaces/IMemeToken.sol";
import {INonfungiblePositionManager} from "../interfaces/INonfungiblePositionManager.sol";
import {ReentrancyGuard} from "../security/ReentrancyGuard.sol";

/// @notice Arc-specific production boundary for a Uniswap V3-compatible DEX.
/// @dev Arc native USDC has 18 decimals through msg.value and the canonical
/// ERC-20 interface has 6 decimals. Both interfaces share the same balance.
contract ArcUniswapV3Adapter is IDexAdapter, ReentrancyGuard {
    error Unauthorized();
    error InvalidAddress();
    error InvalidConfiguration();
    error InvalidLiquidity();
    error TokenTransferFailed();
    error ApprovalFailed();
    error PoolCreationFailed();
    error MintFailed();

    uint256 public constant NATIVE_TO_USDC_SCALE = 1e12;

    address public immutable bootstrapAdmin;
    address public factory;
    uint256 public nativeDust;
    address public immutable usdc;
    INonfungiblePositionManager public immutable positionManager;
    uint24 public immutable poolFee;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;
    uint160 public immutable initialSqrtPriceX96;

    event DexLiquidityCreated(
        address indexed token,
        address indexed pool,
        uint256 indexed tokenId,
        address recipient,
        uint256 tokenAmount,
        uint256 nativeAmount,
        uint256 usdcAmount,
        uint128 liquidity
    );
    event NativeDustRetained(uint256 amount, uint256 totalDust);
    event NativeDustSwept(address indexed recipient, uint256 amount);

    constructor(
        address usdc_,
        address positionManager_,
        uint24 poolFee_,
        int24 tickLower_,
        int24 tickUpper_,
        uint160 initialSqrtPriceX96_
    ) {
        if (usdc_ == address(0) || positionManager_ == address(0)) revert InvalidAddress();
        if (positionManager_.code.length == 0 || usdc_.code.length == 0) revert InvalidAddress();
        if (poolFee_ == 0 || tickLower_ >= tickUpper_ || initialSqrtPriceX96_ == 0) revert InvalidConfiguration();
        bootstrapAdmin = msg.sender;
        usdc = usdc_;
        positionManager = INonfungiblePositionManager(positionManager_);
        poolFee = poolFee_;
        tickLower = tickLower_;
        tickUpper = tickUpper_;
        initialSqrtPriceX96 = initialSqrtPriceX96_;
    }

    function setFactory(address factory_) external {
        if (msg.sender != bootstrapAdmin) revert Unauthorized();
        if (factory != address(0) || factory_ == address(0) || factory_.code.length == 0) revert InvalidAddress();
        factory = factory_;
    }

    function addLiquidity(address token, uint256 tokenAmount, address recipient)
        external
        payable
        nonReentrant
        returns (bytes32 positionId)
    {
        if (factory == address(0)) revert Unauthorized();
        (bool ok, bytes memory result) = msg.sender.staticcall(abi.encodeWithSignature("factory()"));
        if (!ok || result.length != 32 || abi.decode(result, (address)) != factory) revert Unauthorized();
        (ok, result) = factory.staticcall(abi.encodeWithSignature("tokenForPair(address)", msg.sender));
        if (!ok || result.length != 32 || abi.decode(result, (address)) != token) revert Unauthorized();
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        if (tokenAmount == 0 || msg.value == 0) revert InvalidLiquidity();
        uint256 usdcAmount = msg.value / NATIVE_TO_USDC_SCALE;
        if (usdcAmount == 0) revert InvalidLiquidity();
        if (!IMemeToken(token).transferFrom(msg.sender, address(this), tokenAmount)) revert TokenTransferFailed();
        if (!IMemeToken(token).approve(address(positionManager), tokenAmount)) revert ApprovalFailed();
        if (!IMemeToken(usdc).approve(address(positionManager), usdcAmount)) revert ApprovalFailed();

        (address token0, address token1) = token < usdc ? (token, usdc) : (usdc, token);
        uint160 orderedSqrtPriceX96 = initialSqrtPriceX96;
        if (token0 == usdc) {
            uint256 reciprocal = (uint256(1) << 192) / initialSqrtPriceX96;
            if (reciprocal == 0 || reciprocal > type(uint160).max) revert InvalidConfiguration();
            orderedSqrtPriceX96 = uint160(reciprocal);
        }
        address pool = positionManager.createAndInitializePoolIfNecessary(token0, token1, poolFee, orderedSqrtPriceX96);
        if (pool == address(0)) revert PoolCreationFailed();

        (uint256 amount0, uint256 amount1) = token0 == token ? (tokenAmount, usdcAmount) : (usdcAmount, tokenAmount);
        (uint256 tokenId, uint128 liquidity,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: poolFee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: amount0,
                amount1Min: amount1,
                recipient: recipient,
                deadline: block.timestamp
            })
        );
        if (tokenId == 0 || liquidity == 0) revert MintFailed();
        uint256 dust = msg.value % NATIVE_TO_USDC_SCALE;
        if (dust != 0) {
            nativeDust += dust;
            emit NativeDustRetained(dust, nativeDust);
        }
        positionId = bytes32(tokenId);
        emit DexLiquidityCreated(token, pool, tokenId, recipient, tokenAmount, msg.value, usdcAmount, liquidity);
    }

    function sweepNativeDust(address payable recipient) external nonReentrant {
        (bool ok, bytes memory result) = factory.staticcall(abi.encodeWithSignature("owner()"));
        if (!ok || result.length != 32 || msg.sender != abi.decode(result, (address))) revert Unauthorized();
        if (recipient == address(0)) revert InvalidAddress();
        uint256 amount = nativeDust;
        nativeDust = 0;
        (bool sent,) = recipient.call{value: amount}("");
        if (!sent) revert MintFailed();
        emit NativeDustSwept(recipient, amount);
    }
}
