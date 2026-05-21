// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVRFHandler
 * @dev VRF处理器接口，定义VRF相关的标准操作
 */
interface IVRFHandler {
    // ============ 事件 ============
    event RandomnessRequested(uint256 indexed requestId, uint256 indexed tokenId);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 indexed tokenId);

    // ============ 函数 ============
    /**
     * @dev 请求随机数
     * @param tokenId token ID
     * @param callbackContract 回调合约地址
     * @return requestId 请求ID
     */
    function requestRandomness(uint256 tokenId, address callbackContract)
        external
        returns (uint256 requestId);

    /**
     * @dev VRF回调函数
     * @param requestId 请求ID
     * @param randomWords 随机数数组
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external;

    /**
     * @dev 获取请求对应的tokenId
     * @param requestId 请求ID
     * @return tokenId token ID
     */
    function getTokenIdByRequestId(uint256 requestId)
        external
        view
        returns (uint256);

    /**
     * @dev 获取请求对应的回调合约
     * @param requestId 请求ID
     * @return callbackContract 回调合约地址
     */
    function getCallbackContractByRequestId(uint256 requestId)
        external
        view
        returns (address);
}

/**
 * @title IVRFCallback
 * @dev VRF回调接口，主合约需要实现此接口以接收随机数
 */
interface IVRFCallback {
    /**
     * @dev VRF回调函数
     * @param requestId 请求ID
     * @param tokenId token ID
     * @param randomness 随机数
     */
    function handleVRFCallback(
        uint256 requestId,
        uint256 tokenId,
        uint256 randomness
    ) external;
}

