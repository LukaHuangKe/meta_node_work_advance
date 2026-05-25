// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// 导入 Foundry 测试库
import {Test, console2} from "forge-std/Test.sol";
// 导入 OpenZeppelin 代理合约相关
import {TransparentUpgradeableProxy, ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {IERC1967} from "@openzeppelin/contracts/interfaces/IERC1967.sol";

// 导入我们自己的合约
import {MetaNFTAuction} from "./MetaNFTAuction.sol";
import {MetaNFTAuctionV2} from "./MetaNFTAuctionV2.sol";
import {MetaNFT} from "./MetaNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MockOracle} from "./MockOracle.sol";
import {MockERC20} from "./MockERC20.sol";

/**
 * @title MetaNFTAuction 测试合约
 * @dev 使用 Foundry 测试框架测试 NFT 拍卖合约的所有功能
 */
contract MetaNFTAuctionTest is Test {
    // 声明测试中会用到的合约实例
    MetaNFTAuction private auction;  // 拍卖合约，在 setUp 中部署为代理合约的地址、逻辑合约的实例。当你调用 auction.xxx() 时，实际是调用 代理合约 ，代理再转发给 逻辑合约
    MetaNFT private nft;             // NFT 合约
    MockERC20 private usdc;          // 模拟 USDC 代币
    MockOracle private ethOracle;    // ETH 价格预言机（模拟）
    MockOracle private usdcOracle;   // USDC 价格预言机（模拟）
    ProxyAdmin private proxyAdminInstance;  // 代理管理员合约

    // 声明测试中会用到的地址
    address private admin = address(0xA11CE);        // 拍卖合约管理员
    address private proxyAdmin = address(0xBEEF);    // 代理合约管理员
    address private seller = address(0xB0B);         // NFT 卖家
    address private bidder1 = address(0xB0123);      // 竞拍者 1
    address private bidder2 = address(0xB0124);      // 竞拍者 2

    /**
     * @dev 测试设置函数，每个测试用例运行前都会执行
     * 主要工作：
     * 1. 部署拍卖合约实现和代理
     * 2. 部署测试 NFT 和 USDC
     * 3. 设置价格预言机
     * 4. 准备测试 NFT 和授权
     */
    function setUp() public {
        // 1. 部署拍卖合约的实现合约（logic contract）
        MetaNFTAuction impl = new MetaNFTAuction();
        // 编码初始化调用数据（设置 admin）
        bytes memory initData = abi.encodeCall(MetaNFTAuction.initialize, (admin));

        // 2. 部署透明代理合约，这个proxy就是代理合约
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),   // 实现合约地址
            proxyAdmin,      // 代理管理员地址
            initData         // 初始化调用数据
        );

        // 3. 将代理合约地址转换为 MetaNFTAuction 类型
        auction = MetaNFTAuction(address(proxy));

        // 4. 从代理合约的存储槽中读取真实的 ProxyAdmin 地址
        // 这是 ERC1967 规定的 admin 存储槽位置
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdminAddress = address(uint160(uint256(vm.load(address(proxy), adminSlot))));
        proxyAdminInstance = ProxyAdmin(proxyAdminAddress);

        // 5. 部署测试 NFT
        nft = new MetaNFT();
        // 6. 部署模拟 USDC（初始供应量 1,000,000）
        usdc = new MockERC20("USDC", "USDC", 6, 1000000e6);

        // 7. 部署模拟价格预言机
        // ETH 价格 = 3000 USD（8位小数）
        ethOracle = new MockOracle(3000e8);
        // USDC 价格 = 1 USD（8位小数）
        usdcOracle = new MockOracle(1e8);

        // 8. 以 admin 身份设置预言机
        vm.startPrank(admin);  // 开始模拟 admin 地址调用
        auction.setTokenOracle(address(0), address(ethOracle));    // 设置 ETH 预言机
        auction.setTokenOracle(address(usdc), address(usdcOracle)); // 设置 USDC 预言机
        vm.stopPrank();  // 结束模拟

        // 9. 给 seller 铸造 3 个 NFT（tokenId: 1, 2, 10）
        nft.mint(seller, 1);
        nft.mint(seller, 2);
        nft.mint(seller, 10);
        
        // 10. 让 seller 授权拍卖合约可以操作他的 NFT
        vm.startPrank(seller);
        nft.setApprovalForAll(address(auction), true);  // 授权所有 NFT
        vm.stopPrank();
    }

    /**
     * @dev 测试 getVersion 函数
     * 验证合约返回正确的版本号
     */
    function test_getVersion() public {
        assertEq(auction.getVersion(), "MetaNFTAuctionV1");
    }

    /**
     * @dev 测试 getPriceInDollar 函数
     * 验证可以从预言机正确获取 ETH 和 USDC 的价格
     */
    function test_getPriceInDollar() public {
        uint256 ethPrice = auction.getPriceInDollar(address(0));
        uint256 usdcPrice = auction.getPriceInDollar(address(usdc));
        console2.log("ETH/USD price", ethPrice);
        console2.log("USDC/USD price", usdcPrice);
        assertGt(ethPrice, 0);  // 验证价格大于 0
        assertGt(usdcPrice, 0);
    }

    /**
     * @dev 测试 initialize 函数只能被调用一次
     * 验证第二次调用会回滚
     */
    function test_initializeOnlyOnce() public {
        vm.startPrank(admin);
        vm.expectRevert();  // 期望回滚
        auction.initialize(admin);
        vm.stopPrank();
    }

    /**
     * @dev 测试 start 函数只有 admin 可以调用
     * 验证非 admin 调用会回滚
     */
    function test_startOnlyAdmin() public {
        vm.startPrank(seller);
        vm.expectRevert("not admin");
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
        vm.stopPrank();
    }

    /**
     * @dev 测试 auctionId 自增功能
     * 验证每次创建新拍卖，auctionId 都会加 1
     */
    function test_startIncrementsAuctionId() public {
        vm.startPrank(admin);
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
        assertEq(auction.auctionId(), 1);  // 第一次拍卖后 ID 应该是 1
        auction.start(seller, 2, address(nft), 1000, 3600, address(usdc));
        assertEq(auction.auctionId(), 2);  // 第二次拍卖后 ID 应该是 2
        vm.stopPrank();
    }

    /**
     * @dev 测试拍卖结束后无法竞拍
     * 验证超过 auction duration 后，bid 会回滚
     */
    function test_startAuctionGtDuration() public {
        vm.startPrank(admin);
        auction.start(seller, 1, address(nft), 1000, 30, address(usdc));  // 持续 30 秒
        uint256 currentAuctionId = auction.auctionId() - 1;

        vm.deal(seller, 1 ether);  // 给 seller 1 ether
        vm.warp(block.timestamp + 50);  // 快进 50 秒（超过 30 秒）
        console2.log("current time", block.timestamp);
        
        vm.expectRevert("ended");  // 期望回滚，提示"ended"
        vm.startPrank(seller);
        auction.bid{value: 1 ether}(currentAuctionId, 1 ether);
        vm.stopPrank();
    }

    /**
     * @dev 测试出价低于当前最高价会回滚
     * 验证必须出价比当前最高价高
     */
    function test_bidLowerThanHighestBid() public {
        vm.startPrank(admin);
        auction.start(seller, 1, address(nft), 1000, 30, address(usdc));
        uint256 currentAuctionId = auction.auctionId() - 1;

        vm.deal(seller, 2 ether);
        vm.deal(bidder1, 2 ether);

        vm.startPrank(seller);
        auction.bid{value: 2 ether}(currentAuctionId, 2 ether);  // seller 出价 2 ether

        vm.startPrank(bidder1);
        vm.expectRevert("invalid highestBid");  // bidder1 出价 1.2 ether，低于 2 ether，期望回滚
        auction.bid{value: 1.2 ether}(currentAuctionId, 1.2 ether);
        vm.stopPrank();
    }

    /**
     * @dev 测试完整的竞拍流程
     * 验证：
     * 1. bidder1 出价 2 ether
     * 2. bidder2 出价 3 ether（成为新最高价）
     * 3. bidder1 再加价到 4 ether（再次成为最高价）
     * 最后验证最高出价者是 bidder1，金额是 4 ether
     */
    function test_bidResult() public {
        vm.startPrank(admin);
        auction.start(seller, 1, address(nft), 1000, 3600, address(usdc));
        uint256 currentAuctionId = auction.auctionId() - 1;

        vm.deal(seller, 20 ether);
        vm.deal(bidder1, 20 ether);
        vm.deal(bidder2, 20 ether);

        vm.startPrank(bidder1);
        auction.bid{value: 2 ether}(currentAuctionId, 2 ether);  // bidder1 出价 2 ether
        vm.startPrank(bidder2);
        auction.bid{value: 3 ether}(currentAuctionId, 3 ether);  // bidder2 出价 3 ether
        vm.startPrank(bidder1);
        auction.bid{value: 4 ether}(currentAuctionId, 4 ether);  // bidder1 再加价到 4 ether

        // 读取拍卖记录，验证最高出价者和金额
        (, , , , address highestBidder, , , , uint256 highestBid, , ) = auction.auctions(currentAuctionId);

        assertEq(highestBidder, bidder1);  // 验证最高出价者是 bidder1
        assertEq(highestBid, 4 ether);    // 验证最高出价是 4 ether
        vm.stopPrank();
    }

    /**
     * @dev 测试合约升级功能
     * 验证：
     * 1. 升级后旧的状态（如 auctionId）保持不变
     * 2. 新版本的函数可以正常工作
     */
    function test_upgrade() public {
        vm.startPrank(admin);
        auction.start(seller, 10, address(nft), 1000, 3600, address(usdc));
        uint256 oldAuctionId = auction.auctionId();  // 记录升级前的 auctionId
        vm.stopPrank();

        // 部署新版本实现合约
        MetaNFTAuctionV2 newImpl = new MetaNFTAuctionV2();

        // 以 proxyAdmin 的身份运行 proxyAdminInstance 合约的upgradeAndCall代码
        vm.prank(proxyAdmin);
        proxyAdminInstance.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(auction))),
            address(newImpl),
            ""  // 没有额外的初始化数据
        );

        // 将代理合约转换为 V2 类型
        MetaNFTAuctionV2 upgradedAuction = MetaNFTAuctionV2(payable(address(auction)));

        // 验证状态保持不变
        assertEq(upgradedAuction.auctionId(), oldAuctionId);
        // 验证版本号更新
        assertEq(
            keccak256(abi.encodePacked(upgradedAuction.getVersion())),
            keccak256(abi.encodePacked("MetaNFTAuctionV2"))
        );

        // 验证 V2 的新功能可以正常调用
        string memory newFeature = upgradedAuction.newFeature();
        assertEq(
            keccak256(abi.encodePacked(newFeature)),
            keccak256(abi.encodePacked("This is a new feature in V2"))
        );
    }

    /**
     * @dev 测试非 proxyAdmin 无法升级合约
     * 验证只有 proxyAdmin 可以执行升级
     */
    function test_upgradeByNonAdmin() public {
        vm.startPrank(admin);
        auction.start(seller, 10, address(nft), 1000, 3600, address(usdc));
        vm.stopPrank();

        MetaNFTAuctionV2 newImpl = new MetaNFTAuctionV2();

        vm.startPrank(seller);  // 用 seller 身份尝试升级
        vm.expectRevert();     // 期望回滚
        proxyAdminInstance.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(auction))),
            address(newImpl),
            ""
        );
        vm.stopPrank();
    }

    /**
     * @dev 测试升级后仍能正常使用预言机功能
     * 验证：
     * 1. 升级后可以重新设置预言机
     * 2. 新设置的预言机可以正常获取价格
     */
    function test_changeOracleAfterUpgrade() public {
        vm.startPrank(admin);
        auction.start(seller, 10, address(nft), 1000, 3600, address(usdc));
        vm.stopPrank();

        // 部署一个新的 ETH 价格预言机
        MockOracle newEthOracle = new MockOracle(3000e8);

        // 部署 V2 并升级
        MetaNFTAuctionV2 newImpl = new MetaNFTAuctionV2();
        vm.prank(proxyAdmin);
        proxyAdminInstance.upgradeAndCall(
            ITransparentUpgradeableProxy(payable(address(auction))),
            address(newImpl),
            ""
        );

        MetaNFTAuctionV2 upgradedAuction = MetaNFTAuctionV2(payable(address(auction)));

        // 升级后重新设置预言机
        vm.startPrank(admin);
        upgradedAuction.setTokenOracle(address(0), address(newEthOracle));

        // 验证可以从新预言机获取价格
        uint256 newPrice = upgradedAuction.getPriceInDollar(address(0));
        assertEq(newPrice, 3000e8);

        vm.stopPrank();
    }
}