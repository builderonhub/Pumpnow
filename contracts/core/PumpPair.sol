// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMemeToken} from "../interfaces/IMemeToken.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";
import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {Pausable} from "../security/Pausable.sol";
import {ReentrancyGuard} from "../security/ReentrancyGuard.sol";

contract PumpPair is ReentrancyGuard, Pausable {
    error Unauthorized();
    error ZeroAmount();
    error InvalidAddress();
    error InvalidFeeBps();
    error InvalidCurveParameters();
    error SlippageExceeded();
    error InsufficientTokenInventory();
    error InsufficientNativeReserve();
    error NativeTransferFailed();
    error PairNotActive();
    error GraduationFailed();
    error SaleTargetExceeded();

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000;
    uint256 private constant WAD = 1e18;

    IMemeToken public immutable token;
    ITreasury public immutable treasury;
    IDexAdapter public immutable dexAdapter;
    address public immutable factory;
    uint256 public immutable basePrice;
    uint256 public immutable slope;
    uint256 public immutable initialSupply;
    uint256 public immutable graduationTokenAmount;
    uint16 public immutable feeBps;

    uint256 public tokensSold;
    uint256 public nativeReserve;
    enum Status {
        ACTIVE,
        GRADUATED
    }

    Status public status;
    bytes32 public dexPositionId;

    event Buy(
        address indexed buyer,
        address indexed token,
        uint256 tokenAmount,
        uint256 curveCost,
        uint256 fee,
        uint256 nativeReserve
    );
    event Sell(
        address indexed seller,
        address indexed token,
        uint256 tokenAmount,
        uint256 nativeOutput,
        uint256 fee,
        uint256 nativeReserve
    );
    event Graduated(
        address indexed token,
        address indexed pair,
        address indexed adapter,
        uint256 nativeLiquidity,
        uint256 tokenLiquidity,
        bytes32 positionId,
        uint256 timestamp
    );

    constructor(
        address token_,
        address treasury_,
        address factory_,
        address dexAdapter_,
        uint16 feeBps_,
        uint256 basePrice_,
        uint256 slope_,
        uint256 initialSupply_,
        uint256 graduationTokenAmount_
    ) {
        if (token_ == address(0) || treasury_ == address(0) || factory_ == address(0) || dexAdapter_ == address(0)) {
            revert InvalidAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFeeBps();
        if (
            basePrice_ == 0 || initialSupply_ == 0 || graduationTokenAmount_ == 0
                || graduationTokenAmount_ >= initialSupply_
        ) revert InvalidCurveParameters();
        token = IMemeToken(token_);
        treasury = ITreasury(treasury_);
        dexAdapter = IDexAdapter(dexAdapter_);
        factory = factory_;
        feeBps = feeBps_;
        basePrice = basePrice_;
        slope = slope_;
        initialSupply = initialSupply_;
        graduationTokenAmount = graduationTokenAmount_;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    modifier onlyActive() {
        if (status != Status.ACTIVE) revert PairNotActive();
        _;
    }

    function quoteBuy(uint256 tokenAmount) public view returns (uint256 curveCost, uint256 fee, uint256 totalCost) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokensSold + tokenAmount > graduationTokenAmount) revert SaleTargetExceeded();
        curveCost = _curveIntegral(tokensSold, tokensSold + tokenAmount);
        fee = curveCost * feeBps / BPS_DENOMINATOR;
        totalCost = curveCost + fee;
    }

    function quoteSell(uint256 tokenAmount) public view returns (uint256 grossOutput, uint256 fee, uint256 netOutput) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > tokensSold) revert InsufficientNativeReserve();
        grossOutput = _curveIntegral(tokensSold - tokenAmount, tokensSold);
        fee = grossOutput * feeBps / BPS_DENOMINATOR;
        netOutput = grossOutput - fee;
    }

    function buy(uint256 tokenAmount, uint256 maxNativeInput)
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActive
        returns (uint256 totalCost)
    {
        (uint256 curveCost, uint256 fee, uint256 quotedTotal) = quoteBuy(tokenAmount);
        if (quotedTotal > maxNativeInput || msg.value < quotedTotal) revert SlippageExceeded();
        if (token.balanceOf(address(this)) < tokenAmount) revert InsufficientTokenInventory();

        tokensSold += tokenAmount;
        nativeReserve += curveCost;
        if (!token.transfer(msg.sender, tokenAmount)) revert InsufficientTokenInventory();
        if (fee != 0) treasury.collectFee{value: fee}(msg.sender, address(token), fee);
        uint256 refund = msg.value - quotedTotal;
        if (refund != 0) _sendNative(payable(msg.sender), refund);

        emit Buy(msg.sender, address(token), tokenAmount, curveCost, fee, nativeReserve);
        if (tokensSold == graduationTokenAmount) _graduate();
        return quotedTotal;
    }

    function sell(uint256 tokenAmount, uint256 minNativeOutput)
        external
        nonReentrant
        whenNotPaused
        onlyActive
        returns (uint256 netOutput)
    {
        (uint256 grossOutput, uint256 fee, uint256 quotedNet) = quoteSell(tokenAmount);
        if (quotedNet < minNativeOutput) revert SlippageExceeded();
        if (grossOutput > nativeReserve || grossOutput > address(this).balance) revert InsufficientNativeReserve();

        tokensSold -= tokenAmount;
        nativeReserve -= grossOutput;

        if (!token.transferFrom(msg.sender, address(this), tokenAmount)) revert InsufficientTokenInventory();
        if (fee != 0) treasury.collectFee{value: fee}(msg.sender, address(token), fee);
        _sendNative(payable(msg.sender), quotedNet);

        emit Sell(msg.sender, address(token), tokenAmount, quotedNet, fee, nativeReserve);
        return quotedNet;
    }

    function setPaused(bool shouldPause) external onlyFactory {
        _setPaused(shouldPause);
    }

    function _curveIntegral(uint256 fromSold, uint256 toSold) private view returns (uint256) {
        uint256 amount = toSold - fromSold;
        uint256 linearArea =
            slope * (toSold * toSold - fromSold * fromSold) / (2 * graduationTokenAmount * WAD);
        return basePrice * amount / WAD + linearArea;
    }

    function _graduate() private {
        status = Status.GRADUATED;
        uint256 nativeLiquidity = nativeReserve;
        uint256 tokenLiquidity = token.balanceOf(address(this));
        nativeReserve = 0;

        if (!token.approve(address(dexAdapter), tokenLiquidity)) revert GraduationFailed();
        bytes32 positionId = dexAdapter.addLiquidity{value: nativeLiquidity}(address(token), tokenLiquidity, factory);
        if (positionId == bytes32(0)) revert GraduationFailed();
        dexPositionId = positionId;

        emit Graduated(
            address(token),
            address(this),
            address(dexAdapter),
            nativeLiquidity,
            tokenLiquidity,
            positionId,
            block.timestamp
        );
    }

    function _sendNative(address payable recipient, uint256 amount) private {
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
    }
}
