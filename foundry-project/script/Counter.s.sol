// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract CounterScript is Script {
    Counter public counter;

    function setUp() public {}

    function run() public {
        // vm的具体实现都在foundry原生的rust代码里
        vm.startBroadcast();

        counter = new Counter();

        vm.stopBroadcast();
    }
}
