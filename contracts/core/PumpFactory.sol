// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMemeToken} from "../interfaces/IMemeToken.sol";
import {TokenValidation} from "../libraries/TokenValidation.sol";
import {MemeToken} from "../token/MemeToken.sol";
import {PumpPair} from "./PumpPair.sol";
import {Treasury} from "./Treasury.sol";

contract PumpFactory {
    error Unauthorized();
    error InvalidAddress();
    error InvalidFeeBps();
    error InvalidCurveParameters();
    error PairNotRegistered();
    error InvalidThreshold();

    uint16 public constant MAX_FEE_BPS = 1_000;
    uint256 public constant MAX_GRADUATION_THRESHOLD = 1_000_000 ether;

    struct TokenRecord {
        address token;
        address pair;
        address creator;
        uint256 initialSupply;
        uint256 createdAt;
    }

    address public owner;
    Treasury public immutable treasury;
    uint16 public immutable feeBps;
    uint256 public immutable basePrice;
    uint256 public immutable slope;
    uint256 public graduationThreshold;
    address public dexAdapter;

    address[] private _tokens;
    mapping(address token => TokenRecord record) private _records;
    mapping(address token => address pair) public pairFor;
    mapping(address pair => address token) public tokenForPair;
    mapping(address creator => address[] tokens) private _creatorTokens;

    event TokenCreated(
        address indexed token,
        address indexed pair,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 graduationThreshold,
        string description,
        string imageUrl,
        string websiteUrl,
        string xUrl,
        string telegramUrl
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DexAdapterUpdated(address indexed previousAdapter, address indexed newAdapter);
    event GraduationThresholdUpdated(uint256 previousThreshold, uint256 newThreshold);

    constructor(uint16 feeBps_, uint256 basePrice_, uint256 slope_, uint256 graduationThreshold_, address dexAdapter_) {
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFeeBps();
        if (basePrice_ == 0) revert InvalidCurveParameters();
        _validateThreshold(graduationThreshold_);
        if (dexAdapter_ == address(0) || dexAdapter_.code.length == 0) revert InvalidAddress();
        owner = msg.sender;
        feeBps = feeBps_;
        basePrice = basePrice_;
        slope = slope_;
        graduationThreshold = graduationThreshold_;
        dexAdapter = dexAdapter_;
        treasury = new Treasury(msg.sender, address(this));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        string calldata description,
        string calldata imageUrl,
        string calldata websiteUrl,
        string calldata xUrl,
        string calldata telegramUrl
    ) external returns (address tokenAddress, address pairAddress) {
        TokenValidation.validate(name, symbol, initialSupply);

        MemeToken token = new MemeToken(name, symbol);
        tokenAddress = address(token);
        PumpPair pair = new PumpPair(
            tokenAddress, address(treasury), address(this), dexAdapter, feeBps, basePrice, slope, graduationThreshold
        );
        pairAddress = address(pair);
        IMemeToken(tokenAddress).mintInitial(pairAddress, initialSupply);
        treasury.setCollector(pairAddress, true);

        _tokens.push(tokenAddress);
        _creatorTokens[msg.sender].push(tokenAddress);
        pairFor[tokenAddress] = pairAddress;
        tokenForPair[pairAddress] = tokenAddress;
        _records[tokenAddress] = TokenRecord({
            token: tokenAddress,
            pair: pairAddress,
            creator: msg.sender,
            initialSupply: initialSupply,
            createdAt: block.timestamp
        });

        emit TokenCreated(
            tokenAddress,
            pairAddress,
            msg.sender,
            name,
            symbol,
            initialSupply,
            graduationThreshold,
            description,
            imageUrl,
            websiteUrl,
            xUrl,
            telegramUrl
        );
    }

    function setPairPaused(address token, bool shouldPause) external onlyOwner {
        address pair = pairFor[token];
        if (pair == address(0)) revert PairNotRegistered();
        PumpPair(pair).setPaused(shouldPause);
    }

    function setDexAdapter(address newAdapter) external onlyOwner {
        if (newAdapter == address(0) || newAdapter.code.length == 0) revert InvalidAddress();
        emit DexAdapterUpdated(dexAdapter, newAdapter);
        dexAdapter = newAdapter;
    }

    function setGraduationThreshold(uint256 newThreshold) external onlyOwner {
        _validateThreshold(newThreshold);
        emit GraduationThresholdUpdated(graduationThreshold, newThreshold);
        graduationThreshold = newThreshold;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    function tokenAt(uint256 index) external view returns (address) {
        return _tokens[index];
    }

    function tokenRecord(address token) external view returns (TokenRecord memory) {
        return _records[token];
    }

    function tokensByCreator(address creator) external view returns (address[] memory) {
        return _creatorTokens[creator];
    }

    function isRegistered(address token) external view returns (bool) {
        return pairFor[token] != address(0);
    }

    function _validateThreshold(uint256 threshold) private pure {
        if (threshold == 0 || threshold > MAX_GRADUATION_THRESHOLD) revert InvalidThreshold();
    }
}
