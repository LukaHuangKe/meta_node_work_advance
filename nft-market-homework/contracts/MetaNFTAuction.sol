// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MetaNFTAuction is Initializable {
    // 没有修饰符的变量默认是 internal
    address admin;
    // 代币到预言机的映射
    mapping(address => address) public tokenToOracle;

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
    mapping(uint256 => Auction) public auctions;

    event StartBid(uint256 startingBid);
    event Bid(address indexed sender, uint256 amount);
    event EndBid(uint256 indexed auctionId);

    uint256 public auctionId;

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }
    // 初始化
    /**
     * @dev 构造函数，禁用初始化器
     * 
     * 因为本合约使用 OpenZeppelin Initializable 代理模式，
     * 真正的初始化逻辑在 initialize() 函数中，而不是构造函数。
     * 
     * _disableInitializers() 的作用：
     * 1. 防止实现合约部署时被意外初始化（防止 "初始化器在构造函数中被调用" 攻击）
     * 2. 确保只有通过代理合约才能调用 initialize()
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化函数（代理模式下的构造函数）
     * 
     * 在代理合约部署后调用，设置管理员地址。
     * 只能调用一次（由 initializer 修饰符保证）。
     * 
     * @param admin_ 管理员地址，拥有设置预言机和发起拍卖的权限
     */
    function initialize(address admin_) external initializer {
        require(admin_ != address(0), "invalid admin");
        admin = admin_;
    }

    /**
     * @dev 设置代币到 Chainlink 价格预言机的映射
     * 
     * 只能由管理员调用，用于配置不同代币的美元价格数据源。
     * 预言机地址用于在 bid() 和 _toUsd() 中将代币金额转换为美元价值，
     * 以便比较不同出价的美元价值高低。
     * 
     * @param token ERC20 代币合约地址（address(0) 表示 ETH）
     * @param oracle Chainlink AggregatorV3Interface 预言机合约地址

     // 假设在 Sepolia 测试网
    setTokenOracle(
        address(0),  // ETH 用 address(0)
        0x694AA1769357215DE4FAC081bf1f309aDC325306  // ETH/USD 预言机
    );

    setTokenOracle(
        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238,  // USDC 地址
        0xA2F78ab2355fe2f984D808B5CeE7FD0A93652E77  // USDC/USD 预言机
    );
     */
    function setTokenOracle(address token, address oracle) external onlyAdmin {
        require(oracle != address(0), "invalid oracle");
        tokenToOracle[token] = oracle;
    }

    /**
     * @dev 卖家发起 NFT 拍卖
     * 
     * 只能由管理员调用。此函数会：
     * 1. 创建一个新的拍卖记录
     * 2. 将 NFT 从卖家转移到本合约托管
     * 3. 记录起拍价、拍卖时长、支付代币等信息
     * 
     * @param seller NFT 卖家地址
     * @param nftId NFT 的 token ID
     * @param nft NFT 合约地址
     * @param startingPriceInDollar 起拍价（美元，不含小数位，如 100 表示 100 美元）
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
    ) external onlyAdmin {
        require(nft != address(0), "invalid nft");
        require(duration >= 30, "invalid duration");
        require(paymentToken != address(0), "invalid payment token");
        Auction storage auction = auctions[auctionId];
        auction.nft = IERC721(nft);
        auction.nftId = nftId;
        auction.seller = payable(seller);
        auction.startingTime = block.timestamp;
        // 将起拍价转换为 8 位小数格式（与 Chainlink 预言机一致）
        auction.startingPriceInDollar = startingPriceInDollar * 10**8;
        auction.duration = duration;
        auction.paymentToken = IERC20(paymentToken);
        auction.highestBid = 0;
        auction.highestBidder = address(0);
        auction.highestBidInDollar = 0;
        auction.highestBidToken = address(0);
        // 将 NFT 从卖家转移到合约托管
        IERC721(nft).transferFrom(seller, address(this), nftId);
        auctionId++;
        emit StartBid(auctionId);
    }

    /**
     * @dev 买家参与拍卖竞价
     * 
     * 支持两种支付方式：
     * 1. ETH：通过 msg.value 发送，同时 amount 必须等于 msg.value
     * 2. ERC20：通过 transferFrom 从调用者账户转移到合约
     * 
     * 竞价流程：
     * 1. 检查拍卖是否已开始且未结束
     * 2. 根据出价代币类型计算等值美元价格
     * 3. 检查出价是否高于起拍价和当前最高出价
     * 4. 如果之前有更高出价者（非当前出价者），退还其资金
     * 5. 更新最高出价记录
     * 
     * @param auctionId_ 拍卖 ID
     * @param amount 出价金额（最小单位，如 wei）
     */
    function bid(uint256 auctionId_, uint256 amount) external payable {
        Auction storage auction = auctions[auctionId_];
        require(auction.startingTime > 0, "not started");
        require(!isEnded(auctionId_), "ended");
        uint256 bidPrice;
        // 判断是否是使用 ETH 出价
        bool isEthBid = msg.value > 0;
        
        if (isEthBid) {
            // ETH 出价：验证 amount 与 msg.value 一致
            require(amount == msg.value, "amount mismatch");
            // 获取 ETH 对 USD 的价格预言机数据
            uint256 price = getPriceInDollar(address(0));
            // 将 ETH 金额转换为等值美元
            bidPrice = _toUsd(msg.value, 18, price);
        } else {
            // ERC20 代币出价：验证金额大于 0
            require(amount > 0, "invalid amount");
            // 获取该 ERC20 代币对 USD 的价格预言机数据
            uint256 price = getPriceInDollar(address(auction.paymentToken));
            // 获取该代币的小数位数
            uint8 tokenDecimals = IERC20Metadata(address(auction.paymentToken)).decimals();
            // 将代币金额转换为等值美元
            bidPrice = _toUsd(amount, tokenDecimals, price);
            // 将代币从调用者账户转移到合约
            IERC20(address(auction.paymentToken)).transferFrom(msg.sender, address(this), amount);
        }
        
        // 检查出价是否高于起拍价
        require(auction.startingPriceInDollar < bidPrice, "invalid startingPrice");
        // 检查出价是否高于当前最高出价
        require(auction.highestBidInDollar < bidPrice, "invalid highestBid");
        
        // 如果之前有最高出价者且不是当前出价者，退还之前的最高出价资金
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            uint256 refundAmount = auction.highestBid;
            if (refundAmount > 0) {
                if (auction.highestBidToken == address(0)) {
                    // 之前用 ETH 出价，退还 ETH
                    payable(auction.highestBidder).transfer(refundAmount);
                } else {
                    // 之前用 ERC20 代币出价，退还代币
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
     * 任何人都可以在拍卖结束后调用此函数。执行流程：
     * 1. 检查拍卖是否已结束且有有效出价
     * 2. 将 NFT 从合约转移给最高出价者
     * 3. 将最高出价资金（ETH 或 ERC20）转移给卖家
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
                // ETH 出价，直接转账 ETH
                payable(auction.seller).transfer(auction.highestBid);
            } else {
                // ERC20 代币出价，转账代币
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
     * 公式：USD = (代币数量 × 代币价格) / (10^代币小数位数)
     * 
     * 例如：
     * - amount = 1 ether (1e18 wei)
     * - amountDecimals = 18 (ETH 的小数位数)
     * - price = 300000000000 (3000 USD，Chainlink 预言机返回 8 位小数)
     * 
     * 计算过程：
     * scale = 10^18 = 1e18
     * usd = (1e18 × 300000000000) / 1e18 = 300000000000 (即 3000 USD)
     * 
     * @param amount 代币数量（最小单位，如 wei 或 gwei）
     * @param amountDecimals 该代币的小数位数（ETH 是 18，USDC 是 6）
     * @param price 该代币对 USD 的价格（来自 Chainlink 预言机，8 位小数）
     * @return usd 等值的美元金额（8 位小数）
     */
    function _toUsd(uint256 amount, uint256 amountDecimals, uint256 price)
    internal
    pure
    returns (uint256)
    {
        // 计算缩放因子，用于将代币从最小单位转换为完整单位
        uint256 scale = 10 ** amountDecimals;
        // 先将代币数量乘以价格，再除以缩放因子，得到等值的美元
        uint256 usd = (amount * price) / scale;
        return usd;
    }

    function getVersion() external pure virtual returns (string memory) {
        return "MetaNFTAuctionV1";
    }
}