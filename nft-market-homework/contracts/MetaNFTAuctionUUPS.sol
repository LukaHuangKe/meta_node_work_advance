// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MetaNFTAuctionUUPS - 使用 UUPS 代理模式的 NFT 拍卖合约
 * 
 * @dev 与 MetaNFTAuction.sol 的主要区别：
 * 
 * ==================================================
 * 1. 代理模式不同
 * ==================================================
 * - MetaNFTAuction.sol：普通透明代理（Transparent Proxy），需要单独的 ProxyAdmin 合约管理升级
 * - MetaNFTAuctionUUPS.sol：UUPS 代理（Universal Upgradeable Proxy Standard），升级逻辑在实现合约自身
 * 
 * ==================================================
 * 2. 升级方式不同
 * ==================================================
 * - MetaNFTAuction.sol：通过 ProxyAdmin 合约的 upgradeAndCall 函数升级
 * - MetaNFTAuctionUUPS.sol：通过本合约继承的 UUPSUpgradeable 提供的 upgradeTo/upgradeToAndCall 函数升级
 * 
 * ==================================================
 * 3. 权限管理方式不同
 * ==================================================
 * - MetaNFTAuction.sol：
 *   - 使用简单的 admin 变量 + onlyAdmin 修饰符
 *   - 没有所有权转移功能
 * 
 * - MetaNFTAuctionUUPS.sol：
 *   - 使用类 Ownable 模式（_owner 变量 + onlyOwner 修饰符）
 *   - 有 transferOwnership 函数，可以转移所有权
 *   - 有 OwnershipTransferred 事件
 *   - 使用自定义错误 OwnableUnauthorizedAccount
 * 
 * ==================================================
 * 4. 关键新增/变更的函数
 * ==================================================
 * - _authorizeUpgrade()：UUPS 模式必须实现的函数，用于授权升级
 * - owner()：查询当前所有者
 * - transferOwnership()：转移所有权
 * 
 * ==================================================
 * 5. 其他差异
 * ==================================================
 * - 继承的合约不同：MetaNFTAuctionUUPS 额外继承 UUPSUpgradeable
 * - 事件不同：MetaNFTAuctionUUPS 多了 OwnershipTransferred 事件
 * - 变量名不同：admin 改为 _owner（语义更明确）
 * - 修饰符不同：onlyAdmin 改为 onlyOwner
 * - 错误处理不同：MetaNFTAuctionUUPS 使用自定义错误而非字符串
 */
contract MetaNFTAuctionUUPS is Initializable, UUPSUpgradeable {
    // 合约所有者地址（替代原来的 admin）
    address private _owner;
    // 代币到预言机的映射
    mapping(address => address) public tokenToOracle;

    // 拍卖信息结构体
    struct Auction {
        IERC721 nft;
        uint256 nftId;
        address payable seller;
        uint256 startingTime;
        address highestBidder; // 最高出价人
        uint256 startingPriceInDollar;
        uint256 duration;
        IERC20 paymentToken;
        uint256 highestBid; // 最高出价
        uint256 highestBidInDollar;
        address highestBidToken;
    }
    // 拍卖ID到拍卖信息的映射
    mapping(uint256 => Auction) public auctions;

    // 事件定义
    event StartBid(uint256 startingBid);
    event Bid(address indexed sender, uint256 amount);
    event EndBid(uint256 indexed auctionId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner); // 新增：所有权转移事件

    // 当前拍卖ID计数器
    uint256 public auctionId;

    // 自定义错误：非授权账户（替代原来的 require 字符串）
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev 只有合约所有者可以调用的修饰符
     */
    modifier onlyOwner() {
        if (owner() != msg.sender) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    /**
     * @dev 构造函数，禁用初始化器
     * 
     * 因为本合约使用代理模式，真正的初始化在 initialize() 中
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化函数（代理模式下的构造函数）
     * 
     * 设置初始所有者，并触发所有权转移事件
     * 
     * @param admin_ 初始所有者地址
     */
    function initialize(address admin_) external initializer {
        require(admin_ != address(0), "invalid admin");
        _owner = admin_;
        emit OwnershipTransferred(address(0), admin_); // 触发所有权转移事件
    }

    /**
     * @dev UUPS 模式必须实现的授权升级函数
     * 
     * 只有所有者可以授权升级，使用 onlyOwner 修饰符保护
     * 
     * @param 新版本实现合约地址（这里没使用，但 UUPSUpgradeable 要求有这个参数）
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev 获取当前合约所有者地址
     * 
     * @return 所有者地址
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev 转移合约所有权
     * 
     * 只能由当前所有者调用
     * 
     * @param newOwner 新的所有者地址
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid new owner");
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner); // 触发所有权转移事件
    }

    /**
     * @dev 设置代币到 Chainlink 价格预言机的映射
     * 
     * 只能由所有者调用
     * 
     * @param token ERC20 代币合约地址（address(0) 表示 ETH）
     * @param oracle Chainlink AggregatorV3Interface 预言机合约地址
     */
    function setTokenOracle(address token, address oracle) external onlyOwner {
        require(oracle != address(0), "invalid oracle");
        tokenToOracle[token] = oracle;
    }

    /**
     * @dev 卖家发起 NFT 拍卖
     * 
     * 只能由所有者调用
     * 
     * @param seller NFT 卖家地址
     * @param nftId NFT 的 token ID
     * @param nft NFT 合约地址
     * @param startingPriceInDollar 起拍价（美元，不含小数位）
     * @param duration 拍卖持续时长（秒），至少 30 秒
     * @param paymentToken 拍卖支持的 ERC20 支付代币地址
     */
    function start(
        address seller,
        uint256 nftId,
        address nft,
        uint256 startingPriceInDollar,
        uint256 duration,
        address paymentToken
    ) external onlyOwner {
        require(nft != address(0), "invalid nft");
        require(duration >= 30, "invalid duration");
        require(paymentToken != address(0), "invalid payment token");
        Auction storage auction = auctions[auctionId];
        auction.nft = IERC721(nft);
        auction.nftId = nftId;
        auction.seller = payable(seller);
        auction.startingTime = block.timestamp;
        auction.startingPriceInDollar = startingPriceInDollar * 10**8; // 转换为 8 位小数格式
        auction.duration = duration;
        auction.paymentToken = IERC20(paymentToken);
        auction.highestBid = 0;
        auction.highestBidder = address(0);
        auction.highestBidInDollar = 0;
        auction.highestBidToken = address(0);
        IERC721(nft).transferFrom(seller, address(this), nftId); // 将 NFT 托管到合约
        auctionId++;
        emit StartBid(auctionId);
    }

    /**
     * @dev 买家参与拍卖竞价
     * 
     * 支持 ETH 或 ERC20 代币出价
     * 
     * @param auctionId_ 拍卖 ID
     * @param amount 出价金额（最小单位）
     */
    function bid(uint256 auctionId_, uint256 amount) external payable {
        Auction storage auction = auctions[auctionId_];
        require(auction.startingTime > 0, "not started");
        require(!isEnded(auctionId_), "ended");
        uint256 bidPrice;
        bool isEthBid = msg.value > 0; // 判断是否是 ETH 出价
        
        if (isEthBid) {
            // ETH 出价
            require(amount == msg.value, "amount mismatch");
            uint256 price = getPriceInDollar(address(0));
            bidPrice = _toUsd(msg.value, 18, price);
        } else {
            // ERC20 代币出价
            require(amount > 0, "invalid amount");
            uint256 price = getPriceInDollar(address(auction.paymentToken));
            uint8 tokenDecimals = IERC20Metadata(address(auction.paymentToken)).decimals();
            bidPrice = _toUsd(amount, tokenDecimals, price);
            IERC20(address(auction.paymentToken)).transferFrom(msg.sender, address(this), amount);
        }
        
        // 检查出价是否高于起拍价和当前最高价
        require(auction.startingPriceInDollar < bidPrice, "invalid startingPrice");
        require(auction.highestBidInDollar < bidPrice, "invalid highestBid");
        
        // 如果之前有更高出价者，退还其资金
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            uint256 refundAmount = auction.highestBid;
            if (refundAmount > 0) {
                if (auction.highestBidToken == address(0)) {
                    // 退还 ETH
                    payable(auction.highestBidder).transfer(refundAmount);
                } else {
                    // 退还 ERC20 代币
                    IERC20(address(auction.paymentToken)).transfer(auction.highestBidder, refundAmount);
                }
            }
        }
        
        // 更新最高出价记录
        if (isEthBid) {
            auction.highestBid = msg.value;
            auction.highestBidToken = address(0);
        } else {
            auction.highestBid = amount;
            auction.highestBidToken = address(auction.paymentToken);
        }
        auction.highestBidder = msg.sender;
        auction.highestBidInDollar = bidPrice;
        
        emit Bid(msg.sender, msg.value);
    }

    /**
     * @dev 检查拍卖是否已结束
     * 
     * @param auctionId_ 拍卖 ID
     * @return 拍卖是否已结束
     */
    function isEnded(uint256 auctionId_) public view returns (bool) {
        Auction storage auction = auctions[auctionId_];
        return auction.startingTime > 0 && block.timestamp >= auction.startingTime + auction.duration;
    }

    /**
     * @dev 结束拍卖并完成结算
     * 
     * 任何人都可以在拍卖结束后调用
     * 
     * @param auctionId_ 拍卖 ID
     */
    function end(uint256 auctionId_) external {
        Auction storage auction = auctions[auctionId_];
        require(isEnded(auctionId_), "not ended");
        require(auction.highestBidder != address(0), "no bids");

        // 将 NFT 转移给最高出价者
        auction.nft.transferFrom(address(this), auction.highestBidder, auction.nftId);

        // 将最高出价资金转移给卖家
        if (auction.highestBid > 0) {
            if (auction.highestBidToken == address(0)) {
                payable(auction.seller).transfer(auction.highestBid);
            } else {
                IERC20(auction.highestBidToken).transfer(auction.seller, auction.highestBid);
            }
        }
        emit EndBid(auctionId_);
    }

    /**
     * @dev 从 Chainlink 预言机获取代币对 USD 的价格
     * 
     * @param token 代币合约地址（address(0) 表示 ETH）
     * @return 代币价格（8 位小数）
     */
    function getPriceInDollar(address token) public view returns (uint256) {
        AggregatorV3Interface dataFeed;
        address oracle = tokenToOracle[token];
        require(oracle != address(0), "oracle not set");
        dataFeed = AggregatorV3Interface(oracle);
        (
        /* uint80 roundId */
            ,
            int256 answer,
        /*uint256 startedAt*/
            ,
        /*uint256 updatedAt*/
            ,
        /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return uint256(answer);
    }

    /**
     * @dev 将代币金额转换为等值的美元金额
     * 
     * @param amount 代币数量（最小单位）
     * @param amountDecimals 该代币的小数位数
     * @param price 该代币对 USD 的价格（8 位小数）
     * @return 等值的美元金额（8 位小数）
     */
    function _toUsd(uint256 amount, uint256 amountDecimals, uint256 price)
    internal
    pure
    returns (uint256)
    {
        uint256 scale = 10 ** amountDecimals;
        uint256 usd = (amount * price) / scale;
        return usd;
    }

    /**
     * @dev 获取合约版本号
     * 
     * @return 版本字符串
     */
    function getVersion() external pure virtual returns (string memory) {
        return "MetaNFTAuctionUUPS V1";
    }
}
