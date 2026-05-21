// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title SaleManager
 * @dev 销售管理模块，处理销售状态、价格、白名单等
 * @notice 这是一个可升级的独立模块，可以被主合约使用
 */
contract SaleManager is Initializable, OwnableUpgradeable {
    // ============ 枚举 ============
    enum SalePhase {
        NotStarted,    // 未开始
        Whitelist,     // 白名单阶段
        Public         // 公售阶段
    }

    // ============ 状态变量 ============
    bool public saleActive;
    SalePhase public currentPhase;
    uint256 public price;
    uint256 public maxPerWallet;
    uint256 public constant whitelistMaxMint = 3;

    // 白名单映射
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public whitelistMinted;

    // ============ 事件 ============
    event SalePhaseChanged(SalePhase newPhase);
    event PriceUpdated(uint256 newPrice);
    event MaxPerWalletUpdated(uint256 newMax);
    event WhitelistAdded(address[] addresses);
    event WhitelistRemoved(address[] addresses);
    event WhitelistMinted(address indexed user, uint256 count);

    // ============ 初始化 ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化销售管理器
     */
    function initialize(
        uint256 _price,
        uint256 _maxPerWallet
    ) public initializer {
        __Ownable_init(msg.sender);
        price = _price;
        maxPerWallet = _maxPerWallet;
        currentPhase = SalePhase.NotStarted;
        saleActive = false;
    }

    // ============ 销售状态管理 ============
    /**
     * @dev 设置销售状态
     */
    function setSaleActive(bool _active) external onlyOwner {
        saleActive = _active;
    }

    /**
     * @dev 设置销售阶段
     */
    function setSalePhase(SalePhase _phase) external onlyOwner {
        currentPhase = _phase;
        saleActive = (_phase != SalePhase.NotStarted);
        emit SalePhaseChanged(_phase);
    }

    /**
     * @dev 设置价格
     */
    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
        emit PriceUpdated(_price);
    }

    /**
     * @dev 设置每个钱包最大购买数
     */
    function setMaxPerWallet(uint256 _max) external onlyOwner {
        maxPerWallet = _max;
        emit MaxPerWalletUpdated(_max);
    }

    // ============ 白名单管理 ============
    /**
     * @dev 添加白名单
     */
    function addToWhitelist(address[] memory addresses) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = true;
        }
        emit WhitelistAdded(addresses);
    }

    /**
     * @dev 移除白名单
     */
    function removeFromWhitelist(address[] memory addresses)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = false;
        }
        emit WhitelistRemoved(addresses);
    }

    /**
     * @dev 检查是否可以购买
     */
    function canPurchase(
        address user,
        uint256 userBalance,
        uint256 payment
    ) external view returns (bool, string memory) {
        if (!saleActive) {
            return (false, "Sale not active");
        }
        if (payment < price) {
            return (false, "Insufficient payment");
        }
        if (userBalance >= maxPerWallet) {
            return (false, "Max per wallet reached");
        }
        if (currentPhase == SalePhase.Whitelist) {
            if (!whitelist[user]) {
                return (false, "Not whitelisted");
            }
            if (whitelistMinted[user] >= whitelistMaxMint) {
                return (false, "Whitelist mint limit reached");
            }
        }
        return (true, "");
    }

    /**
     * @dev 记录白名单购买
     */
    function recordWhitelistPurchase(address user) external {
        if (currentPhase == SalePhase.Whitelist) {
            whitelistMinted[user]++;
            emit WhitelistMinted(user, whitelistMinted[user]);
        }
    }
}

