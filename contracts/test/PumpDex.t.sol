// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpFactory} from "../core/PumpFactory.sol";
import {PumpPair} from "../core/PumpPair.sol";
import {MemeToken} from "../token/MemeToken.sol";
import {PumpDexFactory} from "../dex/PumpDexFactory.sol";
import {PumpDexPool} from "../dex/PumpDexPool.sol";
import {PumpDexAdapter} from "../adapters/PumpDexAdapter.sol";

interface PumpDexVm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
}

contract PumpDexTest {
    PumpDexVm private constant vm = PumpDexVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant TRADER = address(0xCAFE);

    PumpFactory private launchFactory;
    PumpDexFactory private dexFactory;
    PumpDexAdapter private adapter;
    MemeToken private token;
    PumpPair private bondingPair;

    function setUp() public {
        dexFactory = new PumpDexFactory(30);
        adapter = new PumpDexAdapter(address(dexFactory));
        dexFactory.setPoolCreator(address(adapter));
        launchFactory = new PumpFactory(0, 1 ether, 0, 8_000, address(adapter));
        adapter.setFactory(address(launchFactory));
        (address tokenAddress, address pairAddress) =
            launchFactory.createToken("Pump DEX", "PDEX", 1_000 ether, "", "", "", "", "");
        token = MemeToken(tokenAddress);
        bondingPair = PumpPair(pairAddress);
        vm.deal(TRADER, 1_000 ether);
    }

    function test_RevertUnauthorizedPoolCreationFrontRun() public {
        vm.expectRevert(PumpDexFactory.Unauthorized.selector);
        vm.prank(TRADER);
        dexFactory.createPool(address(token));
    }

    function test_RevertSecondLiquiditySeed() public {
        vm.prank(TRADER);
        bondingPair.buy{value: 800 ether}(800 ether, 800 ether);
        PumpDexPool pool = PumpDexPool(payable(dexFactory.poolFor(address(token))));

        vm.prank(TRADER);
        token.approve(address(pool), 1);
        vm.expectRevert(PumpDexPool.AlreadyInitialized.selector);
        vm.prank(TRADER);
        pool.addLiquidity{value: 1}(1, TRADER);
    }

    function test_RevertPoolCreatorReplayOrUnauthorizedConfiguration() public {
        vm.expectRevert(PumpDexFactory.InvalidAddress.selector);
        dexFactory.setPoolCreator(address(adapter));

        PumpDexFactory freshFactory = new PumpDexFactory(30);
        vm.expectRevert(PumpDexFactory.Unauthorized.selector);
        vm.prank(TRADER);
        freshFactory.setPoolCreator(address(adapter));
    }

    function test_GraduationCreatesPoolAndPermanentlyLocksLiquidity() public {
        vm.prank(TRADER);
        bondingPair.buy{value: 800 ether}(800 ether, 800 ether);

        address poolAddress = dexFactory.poolFor(address(token));
        PumpDexPool pool = PumpDexPool(payable(poolAddress));
        assertTrue(poolAddress != address(0));
        assertEq(uint256(bondingPair.status()), uint256(PumpPair.Status.GRADUATED));
        assertEq(pool.nativeReserve(), 800 ether);
        assertEq(pool.tokenReserve(), 200 ether);
        assertTrue(pool.liquidityOf(adapter.LIQUIDITY_LOCK()) > 0);
        assertEq(token.balanceOf(address(bondingPair)), 0);
        assertEq(address(bondingPair).balance, 0);
    }

    function test_SwapsAfterGraduationAndKeepsReserveAccountingExact() public {
        vm.prank(TRADER);
        bondingPair.buy{value: 800 ether}(800 ether, 800 ether);
        PumpDexPool pool = PumpDexPool(payable(dexFactory.poolFor(address(token))));

        uint256 expectedToken = pool.quoteNativeForToken(0.1 ether);
        vm.prank(TRADER);
        uint256 tokenOut = pool.swapNativeForToken{value: 0.1 ether}(expectedToken, TRADER);
        assertEq(tokenOut, expectedToken);
        assertEq(pool.nativeReserve(), address(pool).balance);
        assertEq(pool.tokenReserve(), token.balanceOf(address(pool)));

        vm.prank(TRADER);
        token.approve(address(pool), tokenOut);
        uint256 expectedNative = pool.quoteTokenForNative(tokenOut);
        vm.prank(TRADER);
        uint256 nativeOut = pool.swapTokenForNative(tokenOut, expectedNative, payable(TRADER));
        assertEq(nativeOut, expectedNative);
        assertEq(pool.nativeReserve(), address(pool).balance);
        assertEq(pool.tokenReserve(), token.balanceOf(address(pool)));
    }

    function test_RejectsUnauthorizedGraduationLiquidity() public {
        vm.expectRevert(PumpDexAdapter.Unauthorized.selector);
        adapter.addLiquidity{value: 1 ether}(address(token), 1 ether, address(this));
    }

    function assertEq(uint256 left, uint256 right) private pure {
        require(left == right, "not equal");
    }

    function assertEq(address left, address right) private pure {
        require(left == right, "not equal");
    }

    function assertTrue(bool value) private pure {
        require(value, "not true");
    }
}
