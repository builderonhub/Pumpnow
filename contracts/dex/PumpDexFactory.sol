// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpDexPool} from "./PumpDexPool.sol";

contract PumpDexFactory {
    error Unauthorized();
    error InvalidAddress();
    error InvalidFee();
    error PoolExists();

    uint16 public immutable feeBps;
    address public immutable bootstrapAdmin;
    address public poolCreator;
    mapping(address token => address pool) public poolFor;
    address[] private _pools;

    event PoolCreated(address indexed token, address indexed pool, uint16 feeBps);
    event PoolCreatorSet(address indexed poolCreator);

    constructor(uint16 feeBps_) {
        if (feeBps_ > 1_000) revert InvalidFee();
        bootstrapAdmin = msg.sender;
        feeBps = feeBps_;
    }

    /// @notice Permanently authorizes the graduation adapter to create pools.
    function setPoolCreator(address poolCreator_) external {
        if (msg.sender != bootstrapAdmin) revert Unauthorized();
        if (poolCreator != address(0) || poolCreator_ == address(0) || poolCreator_.code.length == 0) {
            revert InvalidAddress();
        }
        poolCreator = poolCreator_;
        emit PoolCreatorSet(poolCreator_);
    }

    function createPool(address token) external returns (address pool) {
        if (msg.sender != poolCreator) revert Unauthorized();
        if (token == address(0)) revert InvalidAddress();
        if (poolFor[token] != address(0)) revert PoolExists();
        pool = address(new PumpDexPool(token, feeBps));
        poolFor[token] = pool;
        _pools.push(pool);
        emit PoolCreated(token, pool, feeBps);
    }

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }
}
