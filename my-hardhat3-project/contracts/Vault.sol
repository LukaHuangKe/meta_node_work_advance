// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./Token.sol";

contract Vault {
    Token public token;
    mapping(address => uint256) public deposits;

    constructor(address _token) {
        token = Token(_token);
    }

    function deposit(uint256 amount) public {
        token.transfer(address(this), amount);
        deposits[msg.sender] += amount;
    }
}