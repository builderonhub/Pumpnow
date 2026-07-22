// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {IMemeToken} from "../interfaces/IMemeToken.sol";
import {PumpDexFactory} from "../dex/PumpDexFactory.sol";
import {PumpDexPool} from "../dex/PumpDexPool.sol";
import {ReentrancyGuard} from "../security/ReentrancyGuard.sol";

contract PumpDexAdapter is IDexAdapter, ReentrancyGuard {
    error Unauthorized();
    error InvalidAddress();
    error InvalidLiquidity();
    error TransferFailed();

    address public constant LIQUIDITY_LOCK = 0x000000000000000000000000000000000000dEaD;
    address public immutable bootstrapAdmin;
    PumpDexFactory public immutable dexFactory;
    address public factory;

    event GraduationLiquidityLocked(
        address indexed token,
        address indexed pool,
        uint256 tokenAmount,
        uint256 nativeAmount,
        uint256 liquidity,
        address lock
    );

    constructor(address dexFactory_) {
        if (dexFactory_ == address(0) || dexFactory_.code.length == 0) revert InvalidAddress();
        bootstrapAdmin = msg.sender;
        dexFactory = PumpDexFactory(dexFactory_);
    }

    function setFactory(address factory_) external {
        if (msg.sender != bootstrapAdmin) revert Unauthorized();
        if (factory != address(0) || factory_ == address(0) || factory_.code.length == 0) revert InvalidAddress();
        factory = factory_;
    }

    function addLiquidity(address token, uint256 tokenAmount, address)
        external
        payable
        nonReentrant
        returns (bytes32 positionId)
    {
        if (factory == address(0)) revert Unauthorized();
        (bool ok, bytes memory result) =
            factory.staticcall(abi.encodeWithSignature("tokenForPair(address)", msg.sender));
        if (!ok || result.length != 32 || abi.decode(result, (address)) != token) revert Unauthorized();
        if (tokenAmount == 0 || msg.value == 0) revert InvalidLiquidity();

        address pool = dexFactory.poolFor(token);
        if (pool == address(0)) pool = dexFactory.createPool(token);
        if (!IMemeToken(token).transferFrom(msg.sender, address(this), tokenAmount)) revert TransferFailed();
        if (!IMemeToken(token).approve(pool, tokenAmount)) revert TransferFailed();
        uint256 liquidity = PumpDexPool(payable(pool)).addLiquidity{value: msg.value}(tokenAmount, LIQUIDITY_LOCK);
        positionId = bytes32(uint256(uint160(pool)));
        emit GraduationLiquidityLocked(token, pool, tokenAmount, msg.value, liquidity, LIQUIDITY_LOCK);
    }
}
