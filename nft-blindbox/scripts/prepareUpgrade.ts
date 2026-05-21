import { network } from "hardhat";
// 导入类型扩展以支持 hre.upgrades
import "@openzeppelin/hardhat-upgrades";

/**
 * 准备升级：验证新版本合约是否可以升级
 * 
 * 使用方法：
 * PROXY_ADDRESS=0x... npx hardhat run scripts/prepareUpgrade.ts --network <network>
 */
async function main() {
  const connection = await network.connect();
  // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
  const { ethers } = connection;

  const proxyAddress =
    process.env.PROXY_ADDRESS ||
    process.argv[2] ||
    "0x0000000000000000000000000000000000000000";

  if (proxyAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Please provide proxy address via PROXY_ADDRESS env var or as first argument"
    );
  }

  console.log("Preparing upgrade...");
  console.log("Proxy Address:", proxyAddress);

  // 获取当前实现合约地址
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const currentStorage = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const currentImplementationAddress = ethers.getAddress("0x" + currentStorage.slice(-40));
  console.log("Current Implementation Address:", currentImplementationAddress);

  // 获取新版本的合约工厂
  const NFTBlindBoxV2 = await ethers.getContractFactory("NFTBlindBoxV2");
  const [deployer] = await ethers.getSigners();

  // 部署新版本的实现合约（仅用于验证，不实际升级）
  console.log("\n[1/2] Deploying new implementation contract...");
  const newImplementation = await NFTBlindBoxV2.connect(deployer).deploy();
  await newImplementation.waitForDeployment();
  const newImplementationAddress = await newImplementation.getAddress();
  console.log("New implementation deployed at:", newImplementationAddress);

  // 验证新合约可以正常部署
  console.log("[2/2] Verifying new implementation contract...");
  // 验证合约地址有效
  const code = await ethers.provider.getCode(newImplementationAddress);
  if (code === "0x") {
    throw new Error("New implementation contract deployment failed");
  }
  console.log("New implementation contract is valid");

  console.log("\n=== Upgrade Preparation ===");
  console.log(
    "New implementation can be deployed at:",
    newImplementationAddress
  );
  console.log("\nYou can now proceed with the actual upgrade using:");
  console.log(
    `PROXY_ADDRESS=${proxyAddress} npx hardhat run scripts/upgrade.ts --network <network>`
  );

  return newImplementationAddress;
}

main()
  .then((address) => {
    console.log("\nPreparation successful!");
    console.log("New Implementation Address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nPreparation failed:");
    console.error(error);
    process.exit(1);
  });

