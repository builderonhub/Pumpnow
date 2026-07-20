// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library TokenValidation {
    error EmptyName();
    error EmptySymbol();
    error InvalidInitialSupply();

    function validate(string memory name, string memory symbol, uint256 initialSupply) internal pure {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(symbol).length == 0) revert EmptySymbol();
        if (initialSupply == 0) revert InvalidInitialSupply();
    }
}

