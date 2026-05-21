// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "../interfaces/IVRFHandler.sol";

/**
 * @title VRFHandler
 * @dev VRF处理器合约，负责处理Chainlink VRF集成
 * @notice 这是一个可升级的独立模块，可以被其他合约使用
 */
contract VRFHandler is
    Initializable,
    OwnableUpgradeable,
    IVRFHandler
{
    // ============ 状态变量 ============
    IVRFCoordinatorV2Plus private vrfCoordinator;
    bytes32 private keyHash;
    uint256 private subscriptionId; // VRF v2.5 使用 uint256
    uint32 private callbackGasLimit;
    uint16 private requestConfirmations;
    uint32 private numWords;
    bool private nativePayment; // VRF v2.5 支持原生代币支付

    // 请求ID到tokenId的映射
    mapping(uint256 => uint256) private requestIdToTokenId;
    // 请求ID到回调合约的映射
    mapping(uint256 => address) private requestIdToCallback;

    // ============ 事件 ============
    // 事件定义在 IVRFHandler 接口中，这里不需要重复定义
    event VRFConfigUpdated(
        address indexed coordinator,
        bytes32 keyHash,
        uint256 subscriptionId
    );

    // ============ 错误 ============
    error OnlyCoordinator();
    error InvalidRequestId();

    // ============ 修饰符 ============
    modifier onlyCoordinator() {
        if (msg.sender != address(vrfCoordinator)) {
            revert OnlyCoordinator();
        }
        _;
    }

    // ============ 初始化 ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化VRF处理器（VRF v2.5）
     */
    function initialize(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId, // VRF v2.5 使用 uint256
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        bool _nativePayment // VRF v2.5 支持原生代币支付
    ) public initializer {
        __Ownable_init(msg.sender);
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        numWords = 1;
        nativePayment = _nativePayment;
    }

    // ============ VRF操作 ============
    /**
     * @dev 请求随机数（VRF v2.5）
     * @param tokenId token ID
     * @param callbackContract 回调合约地址
     * @return requestId 请求ID
     */
    function requestRandomness(uint256 tokenId, address callbackContract)
        external
        override
        returns (uint256 requestId)
    {
        // 构建 VRF v2.5 请求结构体
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: numWords,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment})
            )
        });

        requestId = vrfCoordinator.requestRandomWords(req);
        requestIdToTokenId[requestId] = tokenId;
        requestIdToCallback[requestId] = callbackContract;

        emit RandomnessRequested(requestId, tokenId);
    }

    /**
     * @dev VRF回调函数
     * @param requestId 请求ID
     * @param randomWords 随机数数组
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external override onlyCoordinator {
        uint256 tokenId = requestIdToTokenId[requestId];
        address callbackContract = requestIdToCallback[requestId];
        
        if (tokenId == 0 || callbackContract == address(0)) {
            revert InvalidRequestId();
        }

        emit RandomnessFulfilled(requestId, tokenId);

        // 调用回调合约
        IVRFCallback(callbackContract).handleVRFCallback(
            requestId,
            tokenId,
            randomWords[0]
        );

        // 清理映射
        delete requestIdToTokenId[requestId];
        delete requestIdToCallback[requestId];
    }

    /**
     * @dev 获取请求对应的tokenId
     * @param requestId 请求ID
     * @return tokenId token ID
     */
    function getTokenIdByRequestId(uint256 requestId)
        external
        view
        override
        returns (uint256)
    {
        return requestIdToTokenId[requestId];
    }

    /**
     * @dev 获取请求对应的回调合约
     * @param requestId 请求ID
     * @return callbackContract 回调合约地址
     */
    function getCallbackContractByRequestId(uint256 requestId)
        external
        view
        override
        returns (address)
    {
        return requestIdToCallback[requestId];
    }

    // ============ 配置管理 ============
    /**
     * @dev 更新VRF配置（VRF v2.5）
     */
    function updateVRFConfig(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId, // VRF v2.5 使用 uint256
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        bool _nativePayment // VRF v2.5 支持原生代币支付
    ) external onlyOwner {
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        nativePayment = _nativePayment;

        emit VRFConfigUpdated(_vrfCoordinator, _keyHash, _subscriptionId);
    }

    // ============ 查询函数 ============
    function getVRFCoordinator() external view returns (address) {
        return address(vrfCoordinator);
    }

    function getKeyHash() external view returns (bytes32) {
        return keyHash;
    }

    function getSubscriptionId() external view returns (uint256) {
        return subscriptionId;
    }

    function getNativePayment() external view returns (bool) {
        return nativePayment;
    }

    function getCallbackGasLimit() external view returns (uint32) {
        return callbackGasLimit;
    }

    function getRequestConfirmations() external view returns (uint16) {
        return requestConfirmations;
    }
}

