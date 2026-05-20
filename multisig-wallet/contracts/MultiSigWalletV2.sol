// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MultiSigWalletUpgradeable.sol";

/**
 * @title MultiSigWalletV2
 * @dev 升级版本的多签钱包，演示如何添加新功能
 */
contract MultiSigWalletV2 is MultiSigWalletUpgradeable {
    // ============ 新状态变量 ============
    uint256 public version;
    mapping(address => uint256) public ownerVoteCount;

    // ============ 新事件 ============
    event VersionUpgraded(uint256 indexed oldVersion, uint256 indexed newVersion);
    event OwnerVoteCountUpdated(address indexed owner, uint256 indexed newCount);

    // ============ 初始化 V2 ============
    /**
     * @dev 升级到 V2 版本
     * @param _version 版本号
     */
    function initializeV2(uint256 _version) public reinitializer(2) {
        version = _version;
        emit VersionUpgraded(1, _version);
    }

    // ============ 重写确认交易函数 ============
    /**
     * @dev 重写确认交易函数，在确认时自动增加投票计数
     * @notice V2 版本中，确认交易会自动增加所有者的投票计数
     * @param txIndex 交易索引
     *
     * 功能增强：
     * - 继承父类的所有验证逻辑（onlyOwner, txExists, notExecuted, notConfirmed）
     * - 在确认交易后，自动增加确认者的投票计数
     */
    function confirmTransaction(uint256 txIndex)
    public
    override
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    notConfirmed(txIndex)
    {
        // 调用父类的确认逻辑（包含所有验证和状态更新）
        super.confirmTransaction(txIndex);

        // V2 新功能：确认交易时自动增加投票计数
        ownerVoteCount[_msgSender()] += 1;
        emit OwnerVoteCountUpdated(_msgSender(), ownerVoteCount[_msgSender()]);
    }

    // ============ 新功能 ============
    /**
     * @dev 增加所有者的投票计数（演示新功能）
     * @notice 可以手动增加投票计数，但确认交易时会自动增加
     * @param owner 所有者地址
     */
    function incrementOwnerVoteCount(address owner) public onlyOwner {
        require(isOwner[owner], "Not an owner");
        ownerVoteCount[owner] += 1;
        emit OwnerVoteCountUpdated(owner, ownerVoteCount[owner]);
    }

    // ============ 重写撤销确认函数 ============
    /**
     * @dev 重写撤销确认函数，在撤销确认时减少投票计数
     * @notice V2 版本中，撤销确认会减少所有者的投票计数
     * @param txIndex 交易索引
     *
     * 功能增强：
     * - 继承父类的所有验证逻辑（onlyOwner, txExists, notExecuted）
     * - 在撤销确认后，自动减少撤销者的投票计数（但不能低于0）
     */
    function revokeConfirmation(uint256 txIndex)
    public
    override
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    {
        // 调用父类的撤销确认逻辑（包含所有验证和状态更新）
        super.revokeConfirmation(txIndex);

        // V2 新功能：撤销确认时减少投票计数（但不能低于0）
        if (ownerVoteCount[_msgSender()] > 0) {
            ownerVoteCount[_msgSender()] -= 1;
            emit OwnerVoteCountUpdated(_msgSender(), ownerVoteCount[_msgSender()]);
        }
    }

    /**
     * @dev 获取所有者的投票计数
     * @param owner 所有者地址
     * @return 投票计数
     */
    function getOwnerVoteCount(address owner) public view returns (uint256) {
        return ownerVoteCount[owner];
    }

    // ============ 存储间隙 ============
    uint256[48] private __gap;
}