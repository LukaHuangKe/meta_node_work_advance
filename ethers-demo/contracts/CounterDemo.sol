// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract CounterDemo {
    uint256 public number;
    
    event Incremented(address indexed user, uint256 newValue);
    event SetNumber(address indexed user, uint256 newValue);
    
    function increment() public {
        number++;
        emit Incremented(msg.sender, number);
    }
    
    function setNumber(uint256 newNumber) public {
        number = newNumber;
        emit SetNumber(msg.sender, newNumber);
    }
    
    function getNumber() public view returns (uint256) {
        return number;
    }
}