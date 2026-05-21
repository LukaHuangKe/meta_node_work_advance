// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RarityLibrary.sol";

/**
 * @title MetadataLibrary
 * @dev 元数据管理库，处理URI构建和字符串转换
 * @notice 纯逻辑库，不包含状态变量
 */
library MetadataLibrary {
    // ============ 函数 ============
    /**
     * @dev 构建tokenURI
     * @param baseURI 基础URI
     * @param tokenId token ID
     * @param rarity 稀有度
     * @return 完整的tokenURI
     */
    function buildTokenURI(
        string memory baseURI,
        uint256 tokenId,
        RarityLibrary.Rarity rarity
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    baseURI,
                    "/",
                    RarityLibrary.rarityToString(rarity),
                    "/",
                    toString(tokenId),
                    ".json"
                )
            );
    }

    /**
     * @dev 构建盲盒URI
     * @param baseURI 基础URI
     * @return 盲盒URI
     */
    function buildBlindBoxURI(string memory baseURI)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(baseURI, "/blindbox.json"));
    }

    /**
     * @dev 将uint256转换为字符串
     * @param value 数值
     * @return 字符串表示
     */
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev 拼接URI路径
     * @param parts URI部分数组
     * @return 拼接后的完整URI
     */
    function concatenateURI(string[] memory parts)
        internal
        pure
        returns (string memory)
    {
        bytes memory result;
        for (uint256 i = 0; i < parts.length; i++) {
            result = abi.encodePacked(result, parts[i]);
        }
        return string(result);
    }
}

