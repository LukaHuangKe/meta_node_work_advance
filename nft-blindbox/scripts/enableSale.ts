import { network } from "hardhat";

/**
 * 开启NFT盲盒销售
 * 
 * 使用方法：
 * # 开启公售（默认）
 * npx hardhat run scripts/enableSale.ts --network sepolia
 * 
 * # 使用环境变量指定操作
 * PHASE=public npx hardhat run scripts/enableSale.ts --network sepolia
 * PHASE=whitelist npx hardhat run scripts/enableSale.ts --network sepolia
 * PHASE=active npx hardhat run scripts/enableSale.ts --network sepolia
 * PHASE=stop npx hardhat run scripts/enableSale.ts --network sepolia
 * 
 * 参数选项（通过环境变量 PHASE 设置）：
 * - public     - 开启公售（默认）
 * - whitelist  - 开启白名单阶段
 * - active     - 仅开启销售状态
 * - stop       - 停止销售
 */
async function main() {
  const connection = await network.connect();
  // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  console.log("开启NFT盲盒销售...");
  console.log("Deployer:", deployer.address);

  // 从环境变量读取SaleManager地址
  const saleManagerAddress = process.env.SALE_MANAGER_ADDRESS || "";
  
  if (!saleManagerAddress) {
    throw new Error(
      "请设置 SALE_MANAGER_ADDRESS 环境变量\n" +
      "例如: export SALE_MANAGER_ADDRESS=0x..."
    );
  }

  console.log("SaleManager Address:", saleManagerAddress);

  // 获取SaleManager合约实例
  const SaleManager = await ethers.getContractFactory("SaleManager");
  const saleManager = SaleManager.attach(saleManagerAddress);

  // 检查是否为owner
  const owner = await saleManager.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `你不是SaleManager的owner！\n` +
      `当前owner: ${owner}\n` +
      `你的地址: ${deployer.address}`
    );
  }

  // 获取当前状态
  const currentSaleActive = await saleManager.saleActive();
  const currentPhase = await saleManager.currentPhase();
  const price = await saleManager.price();
  const maxPerWallet = await saleManager.maxPerWallet();

  console.log("\n=== 当前状态 ===");
  console.log("销售状态:", currentSaleActive ? "开启" : "关闭");
  const phaseNum = Number(currentPhase);
  console.log("销售阶段:", phaseNum === 0 ? "未开始" : phaseNum === 1 ? "白名单" : "公售");
  console.log("价格:", ethers.formatEther(price), "ETH");
  console.log("每个钱包最大购买数:", maxPerWallet.toString());

  // 从环境变量读取要执行的操作（推荐方式）
  // 使用方法：PHASE=public npx hardhat run scripts/enableSale.ts --network sepolia
  const phase = process.env.PHASE || "public"; // 默认公售

  if (phase === "public") {
    // 开启公售
    console.log("\n=== 开启公售 ===");
    const tx = await saleManager.setSalePhase(2); // SalePhase.Public = 2
    console.log("交易哈希:", tx.hash);
    await tx.wait();
    console.log("✅ 公售已开启！");
  } else if (phase === "whitelist") {
    // 开启白名单阶段
    console.log("\n=== 开启白名单阶段 ===");
    const tx = await saleManager.setSalePhase(1); // SalePhase.Whitelist = 1
    console.log("交易哈希:", tx.hash);
    await tx.wait();
    console.log("✅ 白名单阶段已开启！");
  } else if (phase === "active") {
    // 仅开启销售状态（不改变阶段）
    console.log("\n=== 开启销售状态 ===");
    const tx = await saleManager.setSaleActive(true);
    console.log("交易哈希:", tx.hash);
    await tx.wait();
    console.log("✅ 销售状态已开启！");
  } else if (phase === "stop") {
    // 停止销售
    console.log("\n=== 停止销售 ===");
    const tx = await saleManager.setSaleActive(false);
    console.log("交易哈希:", tx.hash);
    await tx.wait();
    console.log("✅ 销售已停止！");
  } else {
    console.log("\n用法:");
    console.log("  npx hardhat run scripts/enableSale.ts --network <network> [phase]");
    console.log("\n参数:");
    console.log("  public     - 开启公售（默认）");
    console.log("  whitelist  - 开启白名单阶段");
    console.log("  active     - 仅开启销售状态");
    console.log("  stop       - 停止销售");
    process.exit(1);
  }

  // 验证新状态
  const newSaleActive = await saleManager.saleActive();
  const newPhase = await saleManager.currentPhase();
  
  console.log("\n=== 新状态 ===");
  console.log("销售状态:", newSaleActive ? "开启" : "关闭");
  const newPhaseNum = Number(newPhase);
  console.log("销售阶段:", newPhaseNum === 0 ? "未开始" : newPhaseNum === 1 ? "白名单" : "公售");
}

main()
  .then(() => {
    console.log("\n✅ 操作成功！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 操作失败:");
    console.error(error);
    process.exit(1);
  });

