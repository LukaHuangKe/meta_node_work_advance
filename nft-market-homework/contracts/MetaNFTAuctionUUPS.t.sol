// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol"; // 导入 Forge 标准测试库
import "../contracts/MetaNFTAuctionUUPS.sol"; // 导入要测试的 UUPS 拍卖合约
import "../contracts/MetaNFTAuctionUUPS_V2.sol"; // 导入 V2 版本用于测试升级
import "../contracts/MetaNFT.sol"; // 导入 NFT 合约
import "../contracts/MockERC20.sol"; // 导入模拟 ERC20 代币
import "../contracts/MockOracle.sol"; // 导入模拟价格预言机
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"; // 导入 ERC1967 代理合约
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // 导入 ERC721 接口
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // 导入 ERC20 接口

// 定义测试合约，继承 Test
contract MetaNFTAuctionUUPSTest is Test {
    MetaNFTAuctionUUPS public auction; // 声明拍卖合约实例（通过代理访问）
    MetaNFTAuctionUUPS_V2 public auctionV2; // 声明 V2 版本的拍卖合约实例
    MetaNFT public nft; // 声明 NFT 合约实例
    MockERC20 public usdc; // 声明模拟 USDC 代币实例
    MockOracle public ethOracle; // 声明 ETH 价格预言机实例
    MockOracle public usdcOracle; // 声明 USDC 价格预言机实例

    address public admin = address(0x1); // 定义管理员地址
    address public seller = address(0x2); // 定义卖家地址
    address public bidder1 = address(0x3); // 定义竞拍者 1 地址
    address public bidder2 = address(0x4); // 定义竞拍者 2 地址

    // 测试设置函数，每个测试用例运行前都会执行
    function setUp() public {
        // 1. 部署实现合约
        MetaNFTAuctionUUPS implementation = new MetaNFTAuctionUUPS();

        // 2. 编码初始化函数调用数据
        bytes memory initData = abi.encodeCall(MetaNFTAuctionUUPS.initialize, (admin));

        // 3. 部署 ERC1967 代理合约，关联实现合约和初始化数据
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation), // 实现合约地址
            initData // 初始化调用数据
        );

        // 4. 将代理合约地址转换为 MetaNFTAuctionUUPS 类型
        auction = MetaNFTAuctionUUPS(address(proxy));

        // 5. 部署 NFT 合约
        nft = new MetaNFT();
        // 6. 部署模拟 USDC 代币，名称、符号、小数位、初始供应量
        usdc = new MockERC20("USDC", "USDC", 6, 1000000e6);

        // 7. 部署 ETH 价格预言机，设置 ETH 价格为 3000 USD（8 位小数）
        ethOracle = new MockOracle(3000e8);
        // 8. 部署 USDC 价格预言机，设置 USDC 价格为 1 USD（8 位小数）
        usdcOracle = new MockOracle(1e8);

        // 9. 以管理员身份设置预言机
        vm.startPrank(admin); // 开始模拟管理员地址
        auction.setTokenOracle(address(0), address(ethOracle)); // 设置 ETH 预言机
        auction.setTokenOracle(address(usdc), address(usdcOracle)); // 设置 USDC 预言机
        vm.stopPrank(); // 结束模拟

        // 10. 给卖家铸造 3 个 NFT（tokenId 分别为 1、2、10）
        nft.mint(seller, 1);
        nft.mint(seller, 2);
        nft.mint(seller, 10);

        // 11. 卖家授权拍卖合约可以操作他的所有 NFT
        vm.startPrank(seller); // 开始模拟卖家地址
        nft.setApprovalForAll(address(auction), true); // 授权所有 NFT
        vm.stopPrank(); // 结束模拟

        // 12. 给测试账户分配测试以太币
        vm.deal(seller, 10 ether); // 给卖家 10 ether
        vm.deal(bidder1, 10 ether); // 给竞拍者 1 10 ether
        vm.deal(bidder2, 10 ether); // 给竞拍者 2 10 ether
    }

    // 测试初始化函数
    function test_initialize() public {
        assertEq(auction.owner(), admin); // 断言所有者是 admin
        assertEq(auction.getVersion(), "MetaNFTAuctionUUPS V1"); // 断言版本号正确
    }

    // 测试初始化函数不能被调用两次
    function test_initializeCannotBeCalledTwice() public {
        // 期望回滚，错误类型是 Initializable.InvalidInitialization
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        auction.initialize(admin); // 再次调用 initialize 应该回滚
    }

    // 测试设置价格预言机
    function test_setTokenOracle() public {
        vm.startPrank(admin); // 开始模拟管理员
        address newOracle = address(0x123); // 定义一个新的预言机地址
        auction.setTokenOracle(address(0), newOracle); // 设置 ETH 预言机
        assertEq(auction.tokenToOracle(address(0)), newOracle); // 断言预言机地址已更新
        vm.stopPrank(); // 结束模拟
    }

    // 测试只有所有者可以设置预言机
    function test_setTokenOracleOnlyOwner() public {
        vm.startPrank(seller); // 开始模拟卖家（非所有者）
        // 期望回滚，错误类型是 OwnableUnauthorizedAccount
        vm.expectRevert(abi.encodeWithSelector(MetaNFTAuctionUUPS.OwnableUnauthorizedAccount.selector, seller));
        auction.setTokenOracle(address(0), address(0x123)); // 尝试设置预言机应该回滚
        vm.stopPrank(); // 结束模拟
    }

    // 测试发起拍卖
    function test_startAuction() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        assertEq(auction.auctionId(), 1); // 断言拍卖 ID 增加到 1

        // 读取拍卖信息
        (
            IERC721 nftContract,
            uint256 nftId,
            address sellerAddr,
            uint256 startingTime,
            address highestBidder,
            uint256 startingPriceInDollar,
            uint256 duration,
            IERC20 paymentTokenContract,
            uint256 highestBid,
            uint256 highestBidInDollar,
            address highestBidToken
        ) = auction.auctions(0); // 读取第一个拍卖（ID 从 0 开始）

        // 断言各项拍卖信息正确
        assertEq(address(nftContract), address(nft)); // NFT 合约地址
        assertEq(nftId, 1); // NFT ID
        assertEq(sellerAddr, seller); // 卖家地址
        assertGt(startingTime, 0); // 开始时间大于 0
        assertEq(highestBidder, address(0)); // 最高出价者是零地址
        assertEq(startingPriceInDollar, 1000e8); // 起拍价（8 位小数）
        assertEq(duration, 3600); // 持续时间
        assertEq(address(paymentTokenContract), address(usdc)); // 支付代币
        assertEq(highestBid, 0); // 最高出价为 0
        assertEq(highestBidInDollar, 0); // 最高出价美元价值为 0
        assertEq(highestBidToken, address(0)); // 最高出价代币为零地址
        vm.stopPrank(); // 结束模拟
    }

    // 测试只有所有者可以发起拍卖
    function test_startAuctionOnlyOwner() public {
        vm.startPrank(seller); // 开始模拟卖家（非所有者）
        // 期望回滚，错误类型是 OwnableUnauthorizedAccount
        vm.expectRevert(abi.encodeWithSelector(MetaNFTAuctionUUPS.OwnableUnauthorizedAccount.selector, seller));
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 尝试发起拍卖应该回滚
        vm.stopPrank(); // 结束模拟
    }

    // 测试使用 ETH 出价
    function test_bidWithETH() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        vm.stopPrank(); // 结束模拟

        uint256 auctionId_ = auction.auctionId() - 1; // 获取刚创建的拍卖 ID

        vm.startPrank(bidder1); // 开始模拟竞拍者 1
        auction.bid{value: 2 ether}(auctionId_, 2 ether); // 出价 2 ether

        // 读取拍卖信息
        (,,,, address highestBidder,,,, uint256 highestBid,,) = auction.auctions(auctionId_);
        assertEq(highestBidder, bidder1); // 断言最高出价者是 bidder1
        assertEq(highestBid, 2 ether); // 断言最高出价是 2 ether
        vm.stopPrank(); // 结束模拟
    }

    // 测试使用 ERC20 代币出价
    function test_bidWithERC20() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        vm.stopPrank(); // 结束模拟

        uint256 auctionId_ = auction.auctionId() - 1; // 获取刚创建的拍卖 ID

        vm.startPrank(bidder1); // 开始模拟竞拍者 1
        usdc.mint(bidder1, 100000e18); // 给 bidder1 铸造 USDC
        usdc.approve(address(auction), 100000e18); // 授权拍卖合约使用 USDC
        auction.bid(auctionId_, 100000e18); // 出价 100000 USDC

        // 读取拍卖信息
        (,,,, address highestBidder,,,, uint256 highestBid,,) = auction.auctions(auctionId_);
        assertEq(highestBidder, bidder1); // 断言最高出价者是 bidder1
        assertEq(highestBid, 100000e18); // 断言最高出价是 100000 USDC
        vm.stopPrank(); // 结束模拟
    }

    // 测试拍卖结束后不能出价
    function test_bidEnded() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 30, address(usdc)); // 发起持续 30 秒的拍卖
        uint256 auctionId_ = auction.auctionId() - 1; // 获取拍卖 ID
        vm.stopPrank(); // 结束模拟

        vm.warp(block.timestamp + 50); // 快进时间 50 秒，超过拍卖时长

        vm.startPrank(bidder1); // 开始模拟竞拍者 1
        vm.expectRevert("ended"); // 期望回滚，错误信息是 "ended"
        auction.bid{value: 1 ether}(auctionId_, 1 ether); // 尝试出价应该回滚
        vm.stopPrank(); // 结束模拟
    }

    // 测试出价低于当前最高价会回滚
    function test_bidLowerThanHighestBid() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        uint256 auctionId_ = auction.auctionId() - 1; // 获取拍卖 ID
        vm.stopPrank(); // 结束模拟

        vm.startPrank(bidder1); // 开始模拟竞拍者 1
        auction.bid{value: 2 ether}(auctionId_, 2 ether); // 出价 2 ether
        vm.stopPrank(); // 结束模拟

        vm.startPrank(bidder2); // 开始模拟竞拍者 2
        vm.expectRevert("invalid highestBid"); // 期望回滚，错误信息是 "invalid highestBid"
        auction.bid{value: 1 ether}(auctionId_, 1 ether); // 出价 1 ether（低于 2）应该回滚
        vm.stopPrank(); // 结束模拟
    }

    // 测试结束拍卖
    function test_endAuction() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 30, address(usdc)); // 发起拍卖
        uint256 auctionId_ = auction.auctionId() - 1; // 获取拍卖 ID
        vm.stopPrank(); // 结束模拟

        vm.startPrank(bidder1); // 开始模拟竞拍者 1
        auction.bid{value: 2 ether}(auctionId_, 2 ether); // 出价 2 ether
        vm.stopPrank(); // 结束模拟

        vm.warp(block.timestamp + 50); // 快进时间 50 秒，拍卖结束

        uint256 sellerBalanceBefore = seller.balance; // 记录卖家结束前的余额

        auction.end(auctionId_); // 结束拍卖

        assertEq(nft.ownerOf(1), bidder1); // 断言 NFT 转移给了 bidder1
        assertGt(seller.balance, sellerBalanceBefore); // 断言卖家余额增加了
    }

    // 测试升级到 V2 版本
    function test_upgradeToV2() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        uint256 oldAuctionId = auction.auctionId(); // 记录升级前的 auctionId
        vm.stopPrank(); // 结束模拟

        // 部署 V2 版本的实现合约
        MetaNFTAuctionUUPS_V2 newImplementation = new MetaNFTAuctionUUPS_V2();

        vm.startPrank(admin); // 开始模拟管理员
        auction.upgradeToAndCall(address(newImplementation), ""); // 升级到 V2
        vm.stopPrank(); // 结束模拟

        // 将代理地址转换为 V2 类型
        auctionV2 = MetaNFTAuctionUUPS_V2(address(auction));

        // 断言升级后状态保持不变
        assertEq(auctionV2.auctionId(), oldAuctionId); // auctionId 不变
        assertEq(auctionV2.getVersion(), "MetaNFTAuctionUUPS V2"); // 版本号更新
        assertEq(auctionV2.newFeature(), "This is a new feature in UUPS V2"); // 测试新功能
    }

    // 测试只有所有者可以升级
    function test_upgradeOnlyOwner() public {
        // 部署 V2 版本的实现合约
        MetaNFTAuctionUUPS_V2 newImplementation = new MetaNFTAuctionUUPS_V2();

        vm.startPrank(seller); // 开始模拟卖家（非所有者）
        // 期望回滚，错误类型是 OwnableUnauthorizedAccount
        vm.expectRevert(abi.encodeWithSelector(MetaNFTAuctionUUPS.OwnableUnauthorizedAccount.selector, seller));
        auction.upgradeToAndCall(address(newImplementation), ""); // 尝试升级应该回滚
        vm.stopPrank(); // 结束模拟
    }

    // 测试升级后可以设置新的预言机
    function test_upgradeAndSetNewOracle() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc)); // 发起拍卖
        vm.stopPrank(); // 结束模拟

        // 部署 V2 版本的实现合约
        MetaNFTAuctionUUPS_V2 newImplementation = new MetaNFTAuctionUUPS_V2();

        vm.startPrank(admin); // 开始模拟管理员
        auction.upgradeToAndCall(address(newImplementation), ""); // 升级到 V2

        // 将代理地址转换为 V2 类型
        auctionV2 = MetaNFTAuctionUUPS_V2(address(auction));

        // 部署新的 ETH 价格预言机，价格为 4000 USD
        MockOracle newEthOracle = new MockOracle(4000e8);
        auctionV2.setTokenOracle(address(0), address(newEthOracle)); // 设置新预言机

        uint256 price = auctionV2.getPriceInDollar(address(0)); // 获取新价格
        assertEq(price, 4000e8); // 断言价格正确更新
        vm.stopPrank(); // 结束模拟
    }

    // 测试获取美元价格
    function test_getPriceInDollar() public view {
        uint256 price = auction.getPriceInDollar(address(0)); // 获取 ETH 价格
        assertEq(price, 3000e8); // 断言价格是 3000 USD

        uint256 usdcPrice = auction.getPriceInDollar(address(usdc)); // 获取 USDC 价格
        assertEq(usdcPrice, 1e8); // 断言价格是 1 USD
    }

    // 测试判断拍卖是否结束
    function test_isEnded() public {
        vm.startPrank(admin); // 开始模拟管理员
        auction.start(seller, 1, address(nft), 1000, 30, address(usdc)); // 发起持续 30 秒的拍卖
        uint256 auctionId_ = auction.auctionId() - 1; // 获取拍卖 ID
        vm.stopPrank(); // 结束模拟

        assertFalse(auction.isEnded(auctionId_)); // 断言拍卖还未结束

        vm.warp(block.timestamp + 50); // 快进时间 50 秒

        assertTrue(auction.isEnded(auctionId_)); // 断言拍卖已结束
    }

    // 测试所有权转移
    function test_ownershipTransfer() public {
        address newOwner = address(0x5); // 定义新所有者地址

        vm.startPrank(admin); // 开始模拟当前所有者
        auction.transferOwnership(newOwner); // 转移所有权
        assertEq(auction.owner(), newOwner); // 断言所有者已更新
        vm.stopPrank(); // 结束模拟
    }
}
