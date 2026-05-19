// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Token {
    mapping(address => uint256) public balanceOf;

    constructor() {
        uint256 initialSupply = 1000000 * 10**18; // 100万个代币（假设18位小数）
        balanceOf[msg.sender] = initialSupply;
    }

    function transfer(address to, uint256 amount) public {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }
}