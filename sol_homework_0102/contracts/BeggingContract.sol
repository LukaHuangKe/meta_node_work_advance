// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BeggingContract is Ownable{

    struct Donater {
        uint256 amount;
        bool exist;
        uint256 donateCount;
    }

    //一个mapping记录捐赠者的地址和金额
    mapping(address => Donater) public donaters;
    //提现时使用
    address[] public donaterAddr;

    event Donation(address indexed donater, uint256 amount);
    event Withdraw(uint256 indexed withdrawTime, uint256 amount);

    // 初始化合约
    constructor()Ownable(msg.sender){}

    // 捐赠函数
    // 如果要给receive()和fallback()调用的话，那就得是publc
    function donate() public payable {
        require(msg.value > 0, "donate value required");
        require(msg.sender != owner(), "owner can't donate");
        Donater storage donater = donaters[msg.sender];
        donater.amount += msg.value;
        donater.donateCount += 1;
        if(!donater.exist){
            donater.exist = true;
            donaterAddr.push(msg.sender);
        }
        emit Donation(msg.sender, msg.value);
    }

    // 提现函数
    function withdraw() external onlyOwner {
        // check
        uint256 len = donaterAddr.length;
        require(len > 0, "No donaters");

        // effect

        // internation
        // 不需要遍历获取总金额，直接从合约余额中获取
        uint256 balance = address(this).balance;
        if(balance > 0){
            // 给owner转账（使用 call 更安全），可以不加payable的
            (bool success, ) = payable(owner()).call{value: balance}("");
            require(success, "Withdraw failed");
        }

        emit Withdraw(block.timestamp, balance);
    }

    // 查询某个地址的捐赠金额
    function getDonation(address _addr) external view returns(uint256){
        return donaters[_addr].amount;
    }

    function getOwnerAddr() public view virtual returns (address) {
        return owner();
    }

    // 默认的转账函数都直接路由到donate
    receive() external payable {
        require(msg.value > 0, "ETH required");
        donate();
    }

    fallback() external payable {
        // 只有携带 ETH 的未知调用才处理
        if (msg.value > 0) {
            donate();
        } else {
            revert("Function does not exist");
        }
    }
}