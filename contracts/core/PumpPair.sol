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

    IMemeToken public immutable token;
    ITreasury public immutable treasury;
    IDexAdapter public immutable dexAdapter;
    address public immutable factory;
    uint256 public immutable initialSupply;
    uint256 public immutable graduationTokenAmount;
    uint16 public immutable feeBps;

    uint256 public tokensSold;
    uint256 public nativeReserve;
    uint256 public virtualTokenReserve;
    uint256 public virtualNativeReserve;
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
        uint256 initialVirtualTokenReserve_,
        uint256 initialVirtualNativeReserve_,
        uint256 initialSupply_,
        uint256 graduationTokenAmount_
    ) {
        if (token_ == address(0) || treasury_ == address(0) || factory_ == address(0) || dexAdapter_ == address(0)) {
            revert InvalidAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFeeBps();
        if (
            initialVirtualTokenReserve_ <= initialSupply_ || initialVirtualNativeReserve_ == 0 || initialSupply_ == 0
                || graduationTokenAmount_ == 0 || graduationTokenAmount_ >= initialSupply_
        ) revert InvalidCurveParameters();
        token = IMemeToken(token_);
        treasury = ITreasury(treasury_);
        dexAdapter = IDexAdapter(dexAdapter_);
        factory = factory_;
        feeBps = feeBps_;
        virtualTokenReserve = initialVirtualTokenReserve_;
        virtualNativeReserve = initialVirtualNativeReserve_;
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
        uint256 invariant = virtualTokenReserve * virtualNativeReserve;
        uint256 nextVirtualNative = _ceilDiv(invariant, virtualTokenReserve - tokenAmount);
        curveCost = nextVirtualNative - virtualNativeReserve;
        fee = curveCost * feeBps / BPS_DENOMINATOR;
        totalCost = curveCost + fee;
    }

    function quoteSell(uint256 tokenAmount) public view returns (uint256 grossOutput, uint256 fee, uint256 netOutput) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > tokensSold) revert InsufficientNativeReserve();
        uint256 invariant = virtualTokenReserve * virtualNativeReserve;
        uint256 nextVirtualNative = invariant / (virtualTokenReserve + tokenAmount);
        grossOutput = virtualNativeReserve - nextVirtualNative;
        // Integer rounding across prior buys can make a full unwind exceed the
        // real reserve by one wei. Never quote more native value than exists.
        if (grossOutput > nativeReserve) grossOutput = nativeReserve;
        fee = grossOutput * feeBps / BPS_DENOMINATOR;
        netOutput = grossOutput - fee;
    }

    function quoteBuyExactNative(uint256 nativeInput)
        public
        view
        returns (uint256 tokenOutput, uint256 fee, uint256 curveInput)
    {
        if (nativeInput == 0) revert ZeroAmount();
        fee = nativeInput * feeBps / (BPS_DENOMINATOR + feeBps);
        curveInput = nativeInput - fee;
        uint256 invariant = virtualTokenReserve * virtualNativeReserve;
        uint256 nextVirtualToken = _ceilDiv(invariant, virtualNativeReserve + curveInput);
        tokenOutput = virtualTokenReserve - nextVirtualToken;
        uint256 remaining = graduationTokenAmount - tokensSold;
        if (tokenOutput == 0) revert ZeroAmount();
        if (tokenOutput > remaining) {
            tokenOutput = remaining;
            uint256 nextVirtualNative = _ceilDiv(invariant, virtualTokenReserve - remaining);
            curveInput = nextVirtualNative - virtualNativeReserve;
            fee = curveInput * feeBps / BPS_DENOMINATOR;
        }
    }

    function buyExactNative(uint256 minTokenOutput)
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActive
        returns (uint256 tokenOutput)
    {
        uint256 fee;
        uint256 curveInput;
        (tokenOutput, fee, curveInput) = quoteBuyExactNative(msg.value);
        if (tokenOutput < minTokenOutput) revert SlippageExceeded();
        if (token.balanceOf(address(this)) < tokenOutput) revert InsufficientTokenInventory();

        tokensSold += tokenOutput;
        nativeReserve += curveInput;
        virtualTokenReserve -= tokenOutput;
        virtualNativeReserve += curveInput;
        if (!token.transfer(msg.sender, tokenOutput)) revert InsufficientTokenInventory();
        if (fee != 0) treasury.collectFee{value: fee}(msg.sender, address(token), fee);
        uint256 refund = msg.value - curveInput - fee;
        if (refund != 0) _sendNative(payable(msg.sender), refund);

        emit Buy(msg.sender, address(token), tokenOutput, curveInput, fee, nativeReserve);
        if (tokensSold == graduationTokenAmount) _graduate();
    }

    function realTokenReserve() external view returns (uint256) {
        return graduationTokenAmount - tokensSold;
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
        virtualTokenReserve -= tokenAmount;
        virtualNativeReserve += curveCost;
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
        virtualTokenReserve += tokenAmount;
        virtualNativeReserve -= grossOutput;

        if (!token.transferFrom(msg.sender, address(this), tokenAmount)) revert InsufficientTokenInventory();
        if (fee != 0) treasury.collectFee{value: fee}(msg.sender, address(token), fee);
        _sendNative(payable(msg.sender), quotedNet);

        emit Sell(msg.sender, address(token), tokenAmount, quotedNet, fee, nativeReserve);
        return quotedNet;
    }

    function setPaused(bool shouldPause) external onlyFactory {
        _setPaused(shouldPause);
    }

    function _ceilDiv(uint256 numerator, uint256 denominator) private pure returns (uint256) {
        return numerator == 0 ? 0 : (numerator - 1) / denominator + 1;
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
