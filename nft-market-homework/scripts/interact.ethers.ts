import { ethers } from "ethers"; // 导入 ethers.js 库，用于与区块链交互
import hre from "hardhat"; // 导入 Hardhat 运行时环境
import * as dotenv from "dotenv"; // 导入 dotenv 库，用于加载环境变量

dotenv.config(); // 加载 .env 文件中的环境变量到 process.env


/** 
 * * @dev 交互 MetaNFTAuction 合约的脚本（Ethers.js）
 * 这不是一个部署脚本！
 */
const AUCTION_ADDRESS = process.env.AUCTION_ADDRESS || ""; // 从环境变量读取拍卖合约地址
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545"; // 从环境变量读取 RPC 节点地址，默认本地区块链
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""; // 从环境变量读取钱包私钥

// 从 Hardhat 编译产物中获取 MetaNFTAuction 合约的 ABI
async function getAuctionABI() {
  const artifact = await hre.artifacts.readArtifact("MetaNFTAuction"); // 读取合约编译产物
  return artifact.abi; // 返回合约的 ABI（Application Binary Interface）
}

// 主函数，脚本入口
async function main() {
  // 1. 创建 JSON-RPC Provider，连接到区块链节点
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 2. 创建钱包实例，使用私钥签名交易
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // 3. 获取合约 ABI
  const AUCTION_ABI = await getAuctionABI();
  
  // 4. 创建合约实例，用于与拍卖合约交互
  const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, wallet);

  console.log("=== MetaNFTAuction 交互脚本 (Ethers.js) ===\n");
  console.log("连接地址:", AUCTION_ADDRESS); // 打印要连接的合约地址
  console.log("钱包地址:", wallet.address); // 打印当前钱包地址
  console.log("网络:", (await provider.getNetwork()).name, "\n"); // 打印当前连接的网络名称

  console.log("=== 查询操作 ===\n");

  // 查询合约版本号
  const version = await auction.getVersion();
  console.log("1. 合约版本:", version);

  // 查询当前最新的拍卖ID
  const auctionId = await auction.auctionId();
  console.log("2. 当前拍卖ID:", auctionId.toString());

  // 如果有拍卖（auctionId > 0），查询第一个拍卖的详细信息
  if (auctionId > 0n) {
    const auctionData = await auction.auctions(0); // 查询拍卖ID为0的信息
    console.log("\n3. 拍卖 #0 详情:");
    console.log("   - NFT地址:", auctionData[0]);
    console.log("   - NFT ID:", auctionData[1].toString());
    console.log("   - 卖家:", auctionData[2]);
    console.log("   - 开始时间:", new Date(Number(auctionData[3]) * 1000).toISOString()); // 时间戳转日期字符串
    console.log("   - 最高出价者:", auctionData[4]);
    console.log("   - 起拍价(美元):", ethers.formatUnits(auctionData[5], 8)); // 格式化美元价格（8位小数）
    console.log("   - 持续时间:", auctionData[6].toString(), "秒");
    console.log("   - 支付代币:", auctionData[7]);
    console.log("   - 最高出价:", ethers.formatEther(auctionData[8]), "ETH"); // 格式化为ETH单位
    console.log("   - 最高出价(美元):", ethers.formatUnits(auctionData[9], 8)); // 格式化为美元（8位小数）
    console.log("   - 最高出价代币:", auctionData[10]);

    // 查询该拍卖是否已结束
    const ended = await auction.isEnded(0);
    console.log("\n4. 拍卖 #0 是否已结束:", ended);

    // 查询 ETH 的预言机获取的ETH价格
    const ethPrice = await auction.getPriceInDollar(ethers.ZeroAddress);
    console.log("5. ETH 价格(美元):", ethers.formatUnits(ethPrice, 8));

    // 查询ETH预言机合约地址
    const oracle = await auction.tokenToOracle(ethers.ZeroAddress);
    console.log("6. ETH Oracle 地址:", oracle);
  }

  console.log("\n=== 交易操作示例 ===\n");

  console.log("注意: 以下代码展示了如何调用合约函数，实际使用时需要取消注释\n");

  // 示例 1: 设置价格预言机
  // console.log("1. 设置 ETH Oracle...");
  // const oracleAddress = "0x1234567890123456789012345678901234567890";
  // const tx1 = await auction.setTokenOracle(ethers.ZeroAddress, oracleAddress);
  // console.log("交易哈希:", tx1.hash);
  // await tx1.wait();
  // console.log("Oracle 设置成功\n");

  // 示例 2: 启动新拍卖
  // console.log("2. 启动新拍卖...");
  // const sellerAddress = "0x1234567890123456789012345678901234567890";
  // const nftAddress = "0x1234567890123456789012345678901234567890";
  // const nftId = 1;
  // const startingPrice = 1000;
  // const duration = 3600;
  // const paymentToken = "0x1234567890123456789012345678901234567890";
  // const tx2 = await auction.start(sellerAddress, nftId, nftAddress, startingPrice, duration, paymentToken);
  // console.log("交易哈希:", tx2.hash);
  // await tx2.wait();
  // console.log("拍卖启动成功\n");

  // 示例 3: 出价
  // console.log("3. 出价...");
  // const bidAuctionId = 0;
  // const bidAmount = ethers.parseEther("1.0");
  // const tx3 = await auction.bid(bidAuctionId, bidAmount, { value: bidAmount });
  // console.log("交易哈希:", tx3.hash);
  // await tx3.wait();
  // console.log("出价成功\n");

  // 示例 4: 结束拍卖
  // console.log("4. 结束拍卖...");
  // const endAuctionId = 0;
  // const tx4 = await auction.end(endAuctionId);
  // console.log("交易哈希:", tx4.hash);
  // await tx4.wait();
  // console.log("拍卖结束成功\n");

  console.log("=== 监听事件示例 ===\n");

  // 监听所有事件（被注释掉了，取消注释后可以监听）
  // auction.on("StartBid", (auctionId, event) => {
  //   console.log("新拍卖启动:", auctionId.toString());
  // });
  // auction.on("Bid", (sender, amount, event) => {
  //   console.log("新出价:", sender, ethers.formatEther(amount), "ETH");
  // });
  // auction.on("EndBid", (auctionId, event) => {
  //   console.log("拍卖结束:", auctionId.toString());
  // });

  console.log("脚本执行完成!");
}

// 执行主函数
main()
  .then(() => process.exit(0)) // 成功后退出进程
  .catch((error) => { // 捕获错误
    console.error(error); // 打印错误信息
    process.exit(1); // 错误后退出进程
  });
