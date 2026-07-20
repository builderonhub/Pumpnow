// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Pausable {
    error ContractPaused();

    bool public paused;

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    function _setPaused(bool shouldPause) internal {
        if (paused == shouldPause) return;
        paused = shouldPause;
        if (shouldPause) emit Paused(msg.sender);
        else emit Unpaused(msg.sender);
    }
}
