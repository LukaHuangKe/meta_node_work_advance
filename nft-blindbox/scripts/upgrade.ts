import { network } from "hardhat";
// 导入类型扩展以支持 hre.upgrades
import "@openzeppelin/hardhat-upgrades";

/**
 * 升级NFT盲盒合约（UUPS模式）
 * 
 * 使用方法：
 * PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.ts --network <network>
 */
async function main() {
  const connection = await network.connect();
  // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
  const { ethers } = connection;

  // 从环境变量或参数获取代理地址
  const proxyAddress =
    process.env.PROXY_ADDRESS ||
    process.argv[2] ||
    "0x0000000000000000000000000000000000000000";

  if (proxyAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Please provide proxy address via PROXY_ADDRESS env var or as first argument"
    );
  }

  console.log("Upgrading NFTBlindBox...");
  console.log("Proxy Address:", proxyAddress);

  // 获取新版本的合约工厂
  const NFTBlindBoxV2 = await ethers.getContractFactory("NFTBlindBoxV2");
  const [deployer] = await ethers.getSigners();

  // 1. 部署新的实现合约
  console.log("\n[1/2] Deploying new implementation contract...");
  const newImplementation = await NFTBlindBoxV2.connect(deployer).deploy();
  await newImplementation.waitForDeployment();
  const newImplementationAddress = await newImplementation.getAddress();
  console.log("New implementation deployed at:", newImplementationAddress);

  // 2. 获取代理合约实例（使用新实现的接口）
  const proxy = await ethers.getContractAt(
    "NFTBlindBoxV2",
    proxyAddress
  );

  // 3. 调用 upgradeToAndCall 函数（UUPS 模式）
  console.log("[2/2] Upgrading proxy to new implementation...");
  const upgradeTx = await proxy.connect(deployer).upgradeToAndCall(
    newImplementationAddress,
    "0x" // 空数据，只升级
  );
  await upgradeTx.wait();
  console.log("Upgrade transaction confirmed");

  const upgradedAddress = proxyAddress; // 代理地址不变

  console.log("\n=== Upgrade Info ===");
  console.log("Proxy Address (unchanged):", upgradedAddress);
  console.log("New Implementation Address:", newImplementationAddress);

  // 验证升级
  const blindBox = await ethers.getContractAt(
    "NFTBlindBoxV2",
    upgradedAddress
  );

  // 调用V2的初始化函数
  try {
    const tx = await blindBox.initializeV2(2);
    await tx.wait();
    console.log(" V2 initialization completed");

    const version = await blindBox.version();
    console.log("Version:", version.toString());
  } catch (error: any) {
    if (error.message.includes("already initialized")) {
      console.log(" V2 already initialized");
    } else {
      throw error;
    }
  }

  // 验证新功能
  const [commonCount, rareCount, epicCount, legendaryCount] =
    await blindBox.getAllRarityCounts();
  console.log("\n=== Rarity Statistics ===");
  console.log("Common:", commonCount.toString());
  console.log("Rare:", rareCount.toString());
  console.log("Epic:", epicCount.toString());
  console.log("Legendary:", legendaryCount.toString());

  return {
    proxy: upgradedAddress,
    implementation: newImplementationAddress,
  };
}

main()
  .then((result) => {
    console.log("\n Upgrade successful!");
    console.log("Proxy:", result.proxy);
    console.log("New Implementation:", result.implementation);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n Upgrade failed:");
    console.error(error);
    process.exit(1);
  });

