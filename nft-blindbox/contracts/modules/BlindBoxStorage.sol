// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/RarityLibrary.sol";

/**
 * @title BlindBoxStorage
 * @dev 盲盒存储模块，定义盲盒相关的数据结构
 * @notice 这是一个存储库，用于定义数据结构
 */
library BlindBoxStorage {
    // ============ 结构体 ============
    struct BlindBox {
        bool purchased;      // 是否已购买
        bool revealed;       // 是否已揭示
        uint256 purchaseTime; // 购买时间
        uint256 revealTime;   // 揭示时间
    }

    // ============ 函数 ============
    /**
     * @dev 创建新的盲盒结构
     */
    function createBlindBox()
        internal
        view
        returns (BlindBox memory)
    {
        return BlindBox({
            purchased: true,
            revealed: false,
            purchaseTime: block.timestamp,
            revealTime: 0
        });
    }

    /**
     * @dev 标记为已揭示
     */
    function markAsRevealed(BlindBox storage box) internal {
        box.revealed = true;
        box.revealTime = block.timestamp;
    }

    /**
     * @dev 获取盲盒状态
     */
    function getStatus(BlindBox storage box)
        internal
        view
        returns (
            bool purchased,
            bool revealed,
            uint256 purchaseTime,
            uint256 revealTime
        )
    {
        return (
            box.purchased,
            box.revealed,
            box.purchaseTime,
            box.revealTime
        );
    }
}

