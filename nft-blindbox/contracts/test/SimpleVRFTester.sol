// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVRFHandler.sol";

/**
 * @title SimpleVRFTester
 * @dev 简单的VRF测试合约，用于测试VRFHandler是否正常工作
 * @notice 这个合约尽可能简单，以减少gas消耗
 */
contract SimpleVRFTester {
    IVRFHandler public vrfHandler;
    
    // 存储请求ID对应的随机数（只存储，不复杂逻辑）
    mapping(uint256 => uint256) public requestIdToRandomness;
    
    // 事件：用于追踪
    event RandomnessRequested(uint256 indexed requestId, uint256 indexed requestIndex);
    event RandomnessReceived(uint256 indexed requestId, uint256 randomness);
    
    // 请求计数器
    uint256 public requestCount;
    
    constructor(address _vrfHandler) {
        vrfHandler = IVRFHandler(_vrfHandler);
        
    }
    
    /**
     * @dev 请求随机数
     * @param tokenId 任意ID（用于测试，可以是任何数字）
     * @return requestId 请求ID
     */
    function requestRandomness(uint256 tokenId) external returns (uint256 requestId) {
        requestCount++;
        requestId = vrfHandler.requestRandomness(tokenId, address(this));
        emit RandomnessRequested(requestId, requestCount);
        return requestId;
    }
    
    /**
     * @dev VRF回调函数 - 极简实现，只存储随机数
     * @notice 这是VRFHandler会调用的回调函数
     */
    function handleVRFCallback(
        uint256 requestId,
        uint256, // tokenId - 不使用
        uint256 randomness
    ) external {
        // 验证调用者必须是VRFHandler
        require(msg.sender == address(vrfHandler), "Only VRFHandler can call");
        
        // 只做最简单的操作：存储随机数
        requestIdToRandomness[requestId] = randomness;
        
        // 触发事件
        emit RandomnessReceived(requestId, randomness);
    }
    
    /**
     * @dev 获取请求的随机数
     */
    function getRandomness(uint256 requestId) external view returns (uint256) {
        return requestIdToRandomness[requestId];
    }
}

