// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13; // 允许 0.8.13 及以上版本，直到 0.9.0 之前

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}
