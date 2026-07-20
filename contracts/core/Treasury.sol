// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Treasury {
    error Unauthorized();
    error InvalidAddress();
    error InvalidFeePayment();
    error NativeTransferFailed();

    address public owner;
    address public immutable collectorManager;
    mapping(address collector => bool authorized) public isCollector;

    event FeeCollected(address indexed payer, address indexed token, address indexed collector, uint256 amount);
    event CollectorUpdated(address indexed collector, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Withdrawn(address indexed recipient, uint256 amount);

    constructor(address owner_, address collectorManager_) {
        if (owner_ == address(0) || collectorManager_ == address(0)) revert InvalidAddress();
        owner = owner_;
        collectorManager = collectorManager_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setCollector(address collector, bool authorized) external {
        if (msg.sender != collectorManager) revert Unauthorized();
        if (collector == address(0)) revert InvalidAddress();
        isCollector[collector] = authorized;
        emit CollectorUpdated(collector, authorized);
    }

    function collectFee(address payer, address token, uint256 amount) external payable {
        if (!isCollector[msg.sender]) revert Unauthorized();
        if (amount == 0 || msg.value != amount) revert InvalidFeePayment();
        emit FeeCollected(payer, token, msg.sender, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function withdraw(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount > address(this).balance) revert InvalidFeePayment();
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
        emit Withdrawn(recipient, amount);
    }
}
