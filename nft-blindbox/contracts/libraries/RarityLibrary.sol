// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RarityLibrary
 * @dev 稀有度管理库，处理稀有度分配逻辑
 * @notice 这是一个纯逻辑库，不包含状态变量，可以安全地与可升级合约配合使用
 */
library RarityLibrary {
    // ============ 常量 ============
    uint256 public constant COMMON_PROBABILITY = 6000;      // 60%
    uint256 public constant RARE_PROBABILITY = 2500;        // 25%
    uint256 public constant EPIC_PROBABILITY = 1200;        // 12%
    uint256 public constant LEGENDARY_PROBABILITY = 300;    // 3%

    // ============ 枚举 ============
    enum Rarity {
        Common,      // 普通 60%
        Rare,        // 稀有 25%
        Epic,        // 史诗 12%
        Legendary    // 传说 3%
    }

    // ============ 错误定义 ============
    error InvalidRandomness();

    // ============ 函数 ============
    /**
     * @dev 根据随机数分配稀有度
     * @param randomness 随机数
     * @return rarity 分配的稀有度
     */
    function assignRarity(uint256 randomness)
        internal
        pure
        returns (Rarity rarity)
    {
        uint256 randomValue = randomness % 10000;

        if (randomValue < LEGENDARY_PROBABILITY) {
            return Rarity.Legendary;
        } else if (
            randomValue < LEGENDARY_PROBABILITY + EPIC_PROBABILITY
        ) {
            return Rarity.Epic;
        } else if (
            randomValue <
            LEGENDARY_PROBABILITY + EPIC_PROBABILITY + RARE_PROBABILITY
        ) {
            return Rarity.Rare;
        } else {
            return Rarity.Common;
        }
    }

    /**
     * @dev 将稀有度转换为字符串
     * @param rarity 稀有度枚举
     * @return 稀有度字符串
     */
    function rarityToString(Rarity rarity)
        internal
        pure
        returns (string memory)
    {
        if (rarity == Rarity.Common) return "common";
        if (rarity == Rarity.Rare) return "rare";
        if (rarity == Rarity.Epic) return "epic";
        if (rarity == Rarity.Legendary) return "legendary";
        return "unknown";
    }

    /**
     * @dev 获取稀有度的概率（以10000为基数）
     * @param rarity 稀有度
     * @return 概率值
     */
    function getProbability(Rarity rarity)
        internal
        pure
        returns (uint256)
    {
        if (rarity == Rarity.Common) return COMMON_PROBABILITY;
        if (rarity == Rarity.Rare) return RARE_PROBABILITY;
        if (rarity == Rarity.Epic) return EPIC_PROBABILITY;
        if (rarity == Rarity.Legendary) return LEGENDARY_PROBABILITY;
        return 0;
    }

    /**
     * @dev 验证稀有度概率总和是否正确
     * @return 是否正确
     */
    function validateProbabilities() internal pure returns (bool) {
        return (
            COMMON_PROBABILITY +
                RARE_PROBABILITY +
                EPIC_PROBABILITY +
                LEGENDARY_PROBABILITY ==
            10000
        );
    }
}

