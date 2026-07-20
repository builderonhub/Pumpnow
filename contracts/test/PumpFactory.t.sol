// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";
import {PumpPair} from "../core/PumpPair.sol";
import {Treasury} from "../core/Treasury.sol";
import {TokenValidation} from "../libraries/TokenValidation.sol";
import {MemeToken} from "../token/MemeToken.sol";
import {Pausable} from "../security/Pausable.sol";
import {MockDexAdapter} from "../mocks/MockDexAdapter.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function deal(address account, uint256 newBalance) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory logs);
}

contract RejectNative {
    receive() external payable {
        revert("reject native");
    }
}

contract PumpFactoryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint16 private constant FEE_BPS = 100;
    uint256 private constant BASE_PRICE = 0.001 ether;
    uint256 private constant SLOPE = 0.00001 ether;
    uint256 private constant GRADUATION_THRESHOLD = 1 ether;
    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;
    address private constant CREATOR = address(0xBEEF);
    address private constant TRADER = address(0xCAFE);

    PumpFactory private factory;
    MemeToken private token;
    PumpPair private pair;
    Treasury private treasury;
    MockDexAdapter private adapter;

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

    function setUp() public {
        adapter = new MockDexAdapter();
        factory = new PumpFactory(FEE_BPS, BASE_PRICE, SLOPE, GRADUATION_THRESHOLD, address(adapter));
        treasury = factory.treasury();
        vm.prank(CREATOR);
        (address tokenAddress, address pairAddress) =
            factory.createToken("Pump Now", "NOW", INITIAL_SUPPLY, "", "", "", "", "");
        token = MemeToken(tokenAddress);
        pair = PumpPair(pairAddress);
        vm.deal(TRADER, 100 ether);
    }

    function test_CreateTokenMintsSupplyToPairAndStoresRegistry() public view {
        PumpFactory.TokenRecord memory record = factory.tokenRecord(address(token));
        address[] memory creatorTokens = factory.tokensByCreator(CREATOR);

        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(address(pair)), INITIAL_SUPPLY);
        assertEq(token.balanceOf(CREATOR), 0);
        assertEq(factory.pairFor(address(token)), address(pair));
        assertEq(factory.tokenForPair(address(pair)), address(token));
        assertEq(record.pair, address(pair));
        assertEq(record.creator, CREATOR);
        assertEq(creatorTokens[0], address(token));
        assertTrue(treasury.isCollector(address(pair)));
    }

    function test_CreateTokenEmitsTokenCreated() public {
        PumpFactory freshFactory = new PumpFactory(FEE_BPS, BASE_PRICE, SLOPE, GRADUATION_THRESHOLD, address(adapter));
        address expectedToken = computeCreateAddress(address(freshFactory), 2);
        address expectedPair = computeCreateAddress(address(freshFactory), 3);

        vm.expectEmit(true, true, true, true);
        emit TokenCreated(
            expectedToken,
            expectedPair,
            CREATOR,
            "Other",
            "OTH",
            INITIAL_SUPPLY,
            GRADUATION_THRESHOLD,
            "",
            "",
            "",
            "",
            ""
        );
        vm.prank(CREATOR);
        freshFactory.createToken("Other", "OTH", INITIAL_SUPPLY, "", "", "", "", "");
    }

    function test_BuyUpdatesInventoryReserveAndFee() public {
        uint256 amount = 100 ether;
        (uint256 curveCost, uint256 fee, uint256 totalCost) = pair.quoteBuy(amount);

        vm.prank(TRADER);
        pair.buy{value: totalCost}(amount, totalCost);

        assertEq(token.balanceOf(TRADER), amount);
        assertEq(pair.tokensSold(), amount);
        assertEq(pair.nativeReserve(), curveCost);
        assertEq(address(pair).balance, curveCost);
        assertEq(address(treasury).balance, fee);
    }

    function test_BuyRefundsExcessNativeCoin() public {
        uint256 amount = 10 ether;
        (,, uint256 totalCost) = pair.quoteBuy(amount);
        uint256 beforeBalance = TRADER.balance;
        vm.prank(TRADER);
        pair.buy{value: totalCost + 1 ether}(amount, totalCost);
        assertEq(TRADER.balance, beforeBalance - totalCost);
    }

    function test_SellReturnsNativeAndPreservesAccounting() public {
        uint256 amount = 100 ether;
        (uint256 buyCurveCost,, uint256 totalCost) = pair.quoteBuy(amount);
        vm.startPrank(TRADER);
        pair.buy{value: totalCost}(amount, totalCost);
        token.approve(address(pair), amount);
        (uint256 grossOutput, uint256 sellFee, uint256 netOutput) = pair.quoteSell(amount);
        uint256 beforeSellBalance = TRADER.balance;
        pair.sell(amount, netOutput);
        vm.stopPrank();

        assertEq(grossOutput, buyCurveCost);
        assertEq(TRADER.balance, beforeSellBalance + netOutput);
        assertEq(pair.tokensSold(), 0);
        assertEq(pair.nativeReserve(), 0);
        assertEq(address(pair).balance, 0);
        assertEq(token.balanceOf(address(pair)), INITIAL_SUPPLY);
        assertTrue(address(treasury).balance >= sellFee);
    }

    function test_RevertBuyWhenMaxInputBelowQuote() public {
        (,, uint256 totalCost) = pair.quoteBuy(1 ether);
        vm.expectRevert(PumpPair.SlippageExceeded.selector);
        vm.prank(TRADER);
        pair.buy{value: totalCost}(1 ether, totalCost - 1);
    }

    function test_RevertSellWhenMinOutputAboveQuote() public {
        (,, uint256 totalCost) = pair.quoteBuy(1 ether);
        vm.startPrank(TRADER);
        pair.buy{value: totalCost}(1 ether, totalCost);
        token.approve(address(pair), 1 ether);
        (,, uint256 netOutput) = pair.quoteSell(1 ether);
        vm.expectRevert(PumpPair.SlippageExceeded.selector);
        pair.sell(1 ether, netOutput + 1);
        vm.stopPrank();
    }

    function test_RevertZeroAmounts() public {
        vm.expectRevert(PumpPair.ZeroAmount.selector);
        pair.quoteBuy(0);
        vm.expectRevert(PumpPair.ZeroAmount.selector);
        pair.quoteSell(0);
    }

    function test_RevertSellBeyondTokensSold() public {
        vm.expectRevert(PumpPair.InsufficientNativeReserve.selector);
        pair.quoteSell(1 ether);
    }

    function test_RevertSellWhenActualReserveIsInsufficient() public {
        uint256 amount = 1 ether;
        (,, uint256 totalCost) = pair.quoteBuy(amount);
        vm.startPrank(TRADER);
        pair.buy{value: totalCost}(amount, totalCost);
        token.approve(address(pair), amount);
        vm.stopPrank();
        vm.deal(address(pair), 0);
        vm.expectRevert(PumpPair.InsufficientNativeReserve.selector);
        vm.prank(TRADER);
        pair.sell(amount, 0);
    }

    function test_OwnerCanPauseAndUnpausePair() public {
        factory.setPairPaused(address(token), true);
        assertTrue(pair.paused());
        vm.expectRevert(Pausable.ContractPaused.selector);
        vm.prank(TRADER);
        pair.buy{value: 1 ether}(1 ether, 1 ether);
        factory.setPairPaused(address(token), false);
        assertTrue(!pair.paused());
    }

    function test_RevertUnauthorizedPauseAndTreasuryWithdrawal() public {
        vm.expectRevert(PumpFactory.Unauthorized.selector);
        vm.prank(TRADER);
        factory.setPairPaused(address(token), true);
        vm.expectRevert(PumpPair.Unauthorized.selector);
        vm.prank(TRADER);
        pair.setPaused(true);
        vm.expectRevert(Treasury.Unauthorized.selector);
        vm.prank(TRADER);
        treasury.withdraw(payable(TRADER), 0);
    }

    function test_RevertUnauthorizedFeeCollection() public {
        vm.expectRevert(Treasury.Unauthorized.selector);
        vm.prank(TRADER);
        treasury.collectFee{value: 1}(TRADER, address(token), 1);
    }

    function test_AutoGraduatesAtThresholdAndTransfersLiquidity() public {
        MockDexAdapter graduationAdapter = new MockDexAdapter();
        PumpFactory smallThresholdFactory =
            new PumpFactory(FEE_BPS, BASE_PRICE, 0, BASE_PRICE, address(graduationAdapter));
        (, address newPairAddress) =
            smallThresholdFactory.createToken("Graduate", "GRAD", INITIAL_SUPPLY, "", "", "", "", "");
        PumpPair newPair = PumpPair(newPairAddress);
        (,, uint256 totalCost) = newPair.quoteBuy(1 ether);
        vm.prank(TRADER);
        newPair.buy{value: totalCost}(1 ether, totalCost);
        assertEq(uint256(newPair.status()), uint256(PumpPair.Status.GRADUATED));
        assertEq(graduationAdapter.callCount(), 1);
        assertEq(graduationAdapter.lastNativeAmount(), BASE_PRICE);
        assertEq(graduationAdapter.lastTokenAmount(), INITIAL_SUPPLY - 1 ether);
        assertEq(newPair.nativeReserve(), 0);
    }

    function test_GraduationEmitsIndexerEvent() public {
        MockDexAdapter graduationAdapter = new MockDexAdapter();
        PumpFactory smallThresholdFactory =
            new PumpFactory(FEE_BPS, BASE_PRICE, 0, BASE_PRICE, address(graduationAdapter));
        (address newTokenAddress, address newPairAddress) =
            smallThresholdFactory.createToken("Graduate", "GRAD", INITIAL_SUPPLY, "", "", "", "", "");
        PumpPair newPair = PumpPair(newPairAddress);
        (,, uint256 totalCost) = newPair.quoteBuy(1 ether);

        vm.recordLogs();
        vm.prank(TRADER);
        newPair.buy{value: totalCost}(1 ether, totalCost);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 signature = keccak256("Graduated(address,address,address,uint256,uint256,bytes32,uint256)");
        bool found;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == newPairAddress && logs[i].topics[0] == signature) {
                assertEq(address(uint160(uint256(logs[i].topics[1]))), newTokenAddress);
                assertEq(address(uint160(uint256(logs[i].topics[2]))), newPairAddress);
                assertEq(address(uint160(uint256(logs[i].topics[3]))), address(graduationAdapter));
                found = true;
                break;
            }
        }
        assertTrue(found);
    }

    function test_DoesNotGraduateBeforeThreshold() public {
        (,, uint256 totalCost) = pair.quoteBuy(1 ether);
        vm.prank(TRADER);
        pair.buy{value: totalCost}(1 ether, totalCost);
        assertEq(uint256(pair.status()), uint256(PumpPair.Status.ACTIVE));
        assertEq(adapter.callCount(), 0);
    }

    function test_GraduatesOnlyOnceAndLocksBuySell() public {
        MockDexAdapter graduationAdapter = new MockDexAdapter();
        PumpFactory smallThresholdFactory =
            new PumpFactory(FEE_BPS, BASE_PRICE, 0, BASE_PRICE, address(graduationAdapter));
        (address newTokenAddress, address newPairAddress) =
            smallThresholdFactory.createToken("Graduate", "GRAD", INITIAL_SUPPLY, "", "", "", "", "");
        PumpPair newPair = PumpPair(newPairAddress);
        MemeToken newToken = MemeToken(newTokenAddress);
        (,, uint256 totalCost) = newPair.quoteBuy(1 ether);
        vm.startPrank(TRADER);
        newPair.buy{value: totalCost}(1 ether, totalCost);
        vm.expectRevert(PumpPair.PairNotActive.selector);
        newPair.buy{value: totalCost}(1 ether, totalCost);
        newToken.approve(address(newPair), 1 ether);
        vm.expectRevert(PumpPair.PairNotActive.selector);
        newPair.sell(1 ether, 0);
        vm.stopPrank();
        assertEq(graduationAdapter.callCount(), 1);
    }

    function test_OwnerUpdatesAdapterAndThresholdForNewPairs() public {
        MockDexAdapter replacement = new MockDexAdapter();
        factory.setDexAdapter(address(replacement));
        factory.setGraduationThreshold(2 ether);
        (, address newPairAddress) = factory.createToken("Configured", "CFG", INITIAL_SUPPLY, "", "", "", "", "");
        PumpPair newPair = PumpPair(newPairAddress);
        assertEq(address(newPair.dexAdapter()), address(replacement));
        assertEq(newPair.graduationThreshold(), 2 ether);
    }

    function test_RevertUnauthorizedOrInvalidGraduationConfiguration() public {
        vm.startPrank(TRADER);
        vm.expectRevert(PumpFactory.Unauthorized.selector);
        factory.setDexAdapter(address(adapter));
        vm.expectRevert(PumpFactory.Unauthorized.selector);
        factory.setGraduationThreshold(2 ether);
        vm.stopPrank();

        vm.expectRevert(PumpFactory.InvalidAddress.selector);
        factory.setDexAdapter(address(0));
        vm.expectRevert(PumpFactory.InvalidThreshold.selector);
        factory.setGraduationThreshold(0);
        uint256 thresholdAboveLimit = factory.MAX_GRADUATION_THRESHOLD() + 1;
        vm.expectRevert(PumpFactory.InvalidThreshold.selector);
        factory.setGraduationThreshold(thresholdAboveLimit);
    }

    function testFuzz_BuyThenSellRestoresReserve(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) % (100 ether) + 1;
        (,, uint256 totalCost) = pair.quoteBuy(amount);
        vm.deal(TRADER, totalCost);
        vm.startPrank(TRADER);
        pair.buy{value: totalCost}(amount, totalCost);
        token.approve(address(pair), amount);
        (,, uint256 netOutput) = pair.quoteSell(amount);
        pair.sell(amount, netOutput);
        vm.stopPrank();
        assertEq(pair.nativeReserve(), 0);
        assertEq(pair.tokensSold(), 0);
        assertEq(address(pair).balance, 0);
    }

    function testFuzz_QuoteFeeNeverExceedsConfiguredRate(uint96 rawAmount) public view {
        uint256 amount = uint256(rawAmount) % (100 ether) + 1;
        (uint256 curveCost, uint256 fee,) = pair.quoteBuy(amount);
        assertTrue(fee <= curveCost * FEE_BPS / 10_000);
    }

    function invariant_ActivePairAccountingIsSolvent() public view {
        if (pair.status() == PumpPair.Status.ACTIVE) {
            assertTrue(address(pair).balance >= pair.nativeReserve());
            assertEq(pair.tokensSold() + token.balanceOf(address(pair)), INITIAL_SUPPLY);
        }
    }

    function test_RevertTreasuryWithdrawalWhenRecipientRejectsNative() public {
        uint256 amount = 1 ether;
        (,, uint256 totalCost) = pair.quoteBuy(amount);
        vm.prank(TRADER);
        pair.buy{value: totalCost}(amount, totalCost);

        RejectNative rejector = new RejectNative();
        vm.expectRevert(Treasury.NativeTransferFailed.selector);
        treasury.withdraw(payable(address(rejector)), address(treasury).balance);
    }

    function test_RevertInvalidFactoryConfiguration() public {
        vm.expectRevert(PumpFactory.InvalidFeeBps.selector);
        new PumpFactory(1_001, BASE_PRICE, SLOPE, GRADUATION_THRESHOLD, address(adapter));
        vm.expectRevert(PumpFactory.InvalidCurveParameters.selector);
        new PumpFactory(FEE_BPS, 0, SLOPE, GRADUATION_THRESHOLD, address(adapter));
        vm.expectRevert(PumpFactory.InvalidAddress.selector);
        new PumpFactory(FEE_BPS, BASE_PRICE, SLOPE, GRADUATION_THRESHOLD, address(0));
    }

    function test_RevertInvalidTokenMetadata() public {
        vm.expectRevert(TokenValidation.EmptyName.selector);
        factory.createToken("", "NOW", INITIAL_SUPPLY, "", "", "", "", "");
        vm.expectRevert(TokenValidation.EmptySymbol.selector);
        factory.createToken("Pump", "", INITIAL_SUPPLY, "", "", "", "", "");
        vm.expectRevert(TokenValidation.InvalidInitialSupply.selector);
        factory.createToken("Pump", "NOW", 0, "", "", "", "", "");
    }

    function computeCreateAddress(address deployer, uint8 nonce) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, bytes1(nonce))))));
    }

    function assertTrue(bool condition) private pure {
        require(condition, "assertTrue failed");
    }

    function assertEq(address actual, address expected) private pure {
        require(actual == expected, "address assertion failed");
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "uint assertion failed");
    }
}
