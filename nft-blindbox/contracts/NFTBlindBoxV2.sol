// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./NFTBlindBoxUpgradeable.sol";
import "./libraries/RarityLibrary.sol";
import "./modules/BlindBoxStorage.sol";

/**
 * @title NFTBlindBoxV2
 * @dev 升级版本的NFT盲盒合约，添加新功能
 * @notice V2版本新增了统计功能，展示如何在不破坏存储布局的情况下升级
 */
contract NFTBlindBoxV2 is NFTBlindBoxUpgradeable {
    // ============ 新状态变量 ============
    uint256 public version;
    mapping(address => uint256) public userPurchaseCount;
    mapping(uint256 => uint256) public rarityCount; // 统计各稀有度数量

    // ============ 新事件 ============
    event VersionUpgraded(uint256 indexed oldVersion, uint256 indexed newVersion);
    event UserPurchaseCountUpdated(address indexed user, uint256 indexed count);
    event RarityCountUpdated(RarityLibrary.Rarity rarity, uint256 count);

    // ============ 初始化 V2 ============
    /**
     * @dev 升级到 V2 版本
     * @param _version 版本号
     */
    function initializeV2(uint256 _version) public reinitializer(2) {
        version = _version;
        emit VersionUpgraded(1, _version);
    }

    // ============ 重写购买函数（添加新功能）============
    /**
     * @dev 重写购买函数，添加购买统计
     */
    function purchaseBox() external payable override nonReentrant {
        // 使用SaleManager检查购买条件（继承自父合约）
        uint256 userBalance = balanceOf(msg.sender);
        (bool canBuy, string memory reason) = saleManager.canPurchase(
            msg.sender,
            userBalance,
            msg.value
        );
        require(canBuy, reason);

        require(totalSupply < maxSupply, "Sold out");

        // 记录白名单购买
        saleManager.recordWhitelistPurchase(msg.sender);

        uint256 tokenId = totalSupply;
        totalSupply++;

        // 铸造NFT（未揭示状态）
        _safeMint(msg.sender, tokenId);

        // 设置盲盒状态（使用存储库，继承自父合约）
        blindBoxes[tokenId] = BlindBoxStorage.createBlindBox();

        // 更新用户购买统计（V2新功能）
        userPurchaseCount[msg.sender]++;
        emit UserPurchaseCountUpdated(msg.sender, userPurchaseCount[msg.sender]);

        // 请求随机数（通过 vrfHandler，继承自父合约）
        vrfHandler.requestRandomness(tokenId, address(this));

        emit BoxPurchased(msg.sender, tokenId);
    }

    // ============ 重写VRF回调（添加统计）============
    /**
     * @dev 重写VRF回调，添加统计功能
     * @notice V2版本在稀有度分配时增加统计功能
     */
    function handleVRFCallback(
        uint256 /* requestId */, // 保留用于接口兼容性，实际未使用
        uint256 tokenId,
        uint256 randomness
    ) external override {
        // 验证调用者（只验证调用者，revealBox 中会验证 token 存在，避免重复检查）
        require(
            msg.sender == address(vrfHandler),
            "Only VRF handler can call"
        );

        // 使用RarityLibrary分配稀有度
        RarityLibrary.Rarity rarity = RarityLibrary.assignRarity(randomness);
        tokenRarity[tokenId] = rarity;
        emit RarityAssigned(tokenId, rarity);

        // V2新功能：统计稀有度数量
        rarityCount[uint256(rarity)]++;
        emit RarityCountUpdated(rarity, rarityCount[uint256(rarity)]);

        // 揭示盲盒（内部函数会验证 token 存在）
        revealBox(tokenId);
    }

    // ============ 新功能函数 ============
    /**
     * @dev 获取用户购买次数
     * @param user 用户地址
     * @return 购买次数
     */
    function getUserPurchaseCount(address user)
        public
        view
        returns (uint256)
    {
        return userPurchaseCount[user];
    }

    /**
     * @dev 获取指定稀有度的数量
     * @param rarity 稀有度
     * @return 数量
     */
    function getRarityCount(RarityLibrary.Rarity rarity)
        public
        view
        returns (uint256)
    {
        return rarityCount[uint256(rarity)];
    }

    /**
     * @dev 获取所有稀有度统计
     * @return commonCount 普通数量
     * @return rareCount 稀有数量
     * @return epicCount 史诗数量
     * @return legendaryCount 传说数量
     */
    function getAllRarityCounts()
        public
        view
        returns (
            uint256 commonCount,
            uint256 rareCount,
            uint256 epicCount,
            uint256 legendaryCount
        )
    {
        return (
            rarityCount[uint256(RarityLibrary.Rarity.Common)],
            rarityCount[uint256(RarityLibrary.Rarity.Rare)],
            rarityCount[uint256(RarityLibrary.Rarity.Epic)],
            rarityCount[uint256(RarityLibrary.Rarity.Legendary)]
        );
    }

    // ============ 存储间隙 ============
    uint256[46] private __gap;
}

