import { network } from "hardhat";
import { createRequire } from "module";
// 导入类型扩展以支持 hre.upgrades
import "@openzeppelin/hardhat-upgrades";

const require = createRequire(import.meta.url);

/**
 * 获取部署配置（优先环境变量，然后 hardhat 配置）
 */
async function getDeploymentConfig() {
  // 尝试从 hardhat 配置读取（作为 fallback）
  let configFromFile: any = null;
  try {
    // @ts-ignore - 动态导入可能无法正确解析类型
    const configModule = await import("../hardhat.config.js");
    configFromFile = configModule.deploymentConfig;
  } catch (e) {
    // 如果导入失败，使用默认配置
    configFromFile = {
      sale: { price: "0.08", maxPerWallet: "10" },
      vrf: {
        sepolia: { coordinator: "", keyHash: "", subscriptionId: "0", callbackGasLimit: "100000", requestConfirmations: "3" },
        mainnet: { coordinator: "", keyHash: "", subscriptionId: "0", callbackGasLimit: "100000", requestConfirmations: "3" },
        localhost: { coordinator: "0x0000000000000000000000000000000000000000", keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", subscriptionId: "1", callbackGasLimit: "100000", requestConfirmations: "3" },
      },
    };
  }
  return configFromFile;
}

/**
 * 手动部署 UUPS 代理（因为 hre.upgrades 在 Hardhat 3 中不可用）
 */
async function deployUUPSProxy(
  ContractFactory: any,
  initArgs: any[],
  signer: any,
  ethers: any
) {
  // 1. 部署实现合约
  const implementation = await ContractFactory.connect(signer).deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  // 2. 获取初始化数据
  const initData = ContractFactory.interface.encodeFunctionData("initialize", initArgs);

  // 3. 从 OpenZeppelin 的 artifact 读取 ERC1967Proxy
  const ERC1967ProxyArtifact = require("@openzeppelin/contracts/build/contracts/ERC1967Proxy.json");
  const ERC1967ProxyFactory = new ethers.ContractFactory(
    ERC1967ProxyArtifact.abi,
    ERC1967ProxyArtifact.bytecode,
    signer
  );
  
  // 4. 部署代理
  const proxy = await ERC1967ProxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  // 5. 返回代理合约实例
  return await ethers.getContractAt(ContractFactory.interface, proxyAddress);
}

/**
 * 部署模块合约（SaleManager和VRFHandler）
 * 
 * 使用方法：
 * npx hardhat run scripts/deployModules.ts --network sepolia
 * npx hardhat run scripts/deployModules.ts --network mainnet
 * npx hardhat run scripts/deployModules.ts --network localhost
 */
async function main() {
  const connection = await network.connect();
  // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying modules...");
  console.log("Deployer:", deployer.address);
  
  // 获取网络名称（从命令行参数 --network 获取）
  let networkName = "hardhat"; // 默认值
  const networkIndex = process.argv.indexOf("--network");
  if (networkIndex !== -1 && process.argv[networkIndex + 1]) {
    networkName = process.argv[networkIndex + 1];
  } else {
    // 如果命令行参数中没有，尝试根据 chainId 判断
    const networkInfo = await ethers.provider.getNetwork();
    const chainId = Number(networkInfo.chainId);
    if (chainId === 11155111) {
      networkName = "sepolia";
    } else if (chainId === 1) {
      networkName = "mainnet";
    } else if (chainId === 31337) {
      networkName = "hardhat";
    }
  }
  console.log("Network:", networkName);

  // 获取部署配置（优先环境变量，然后 hardhat 配置）
  const deploymentConfig = await getDeploymentConfig();
  
  // 优先从环境变量读取配置，如果没有则从 hardhat 配置读取
  const salePrice = process.env.SALE_PRICE || deploymentConfig.sale.price;
  const maxPerWallet = process.env.SALE_MAX_PER_WALLET || deploymentConfig.sale.maxPerWallet;

  // 根据网络选择VRF配置（优先环境变量，然后 hardhat 配置）
  let vrfCoordinator: string;
  let keyHash: string;
  let subscriptionId: bigint;
  let callbackGasLimit: number;
  let requestConfirmations: number;

  if (networkName === "sepolia") {
    const vrfConfig = deploymentConfig.vrf.sepolia;
    vrfCoordinator = process.env.SEPOLIA_VRF_COORDINATOR || vrfConfig.coordinator;
    keyHash = process.env.SEPOLIA_KEY_HASH || vrfConfig.keyHash;
    const subIdStr = process.env.SEPOLIA_SUBSCRIPTION_ID || vrfConfig.subscriptionId;
    subscriptionId = BigInt(subIdStr);
    callbackGasLimit = parseInt(process.env.SEPOLIA_CALLBACK_GAS_LIMIT || vrfConfig.callbackGasLimit);
    requestConfirmations = parseInt(process.env.SEPOLIA_REQUEST_CONFIRMATIONS || vrfConfig.requestConfirmations);
  } else if (networkName === "mainnet") {
    const vrfConfig = deploymentConfig.vrf.mainnet;
    vrfCoordinator = process.env.MAINNET_VRF_COORDINATOR || vrfConfig.coordinator;
    keyHash = process.env.MAINNET_KEY_HASH || vrfConfig.keyHash;
    const subIdStr = process.env.MAINNET_SUBSCRIPTION_ID || vrfConfig.subscriptionId;
    subscriptionId = BigInt(subIdStr);
    callbackGasLimit = parseInt(process.env.MAINNET_CALLBACK_GAS_LIMIT || vrfConfig.callbackGasLimit);
    requestConfirmations = parseInt(process.env.MAINNET_REQUEST_CONFIRMATIONS || vrfConfig.requestConfirmations);
  } else {
    // localhost 或 hardhat，使用占位符（优先环境变量，然后 hardhat 配置）
    const vrfConfig = deploymentConfig.vrf.localhost;
    vrfCoordinator = process.env.SEPOLIA_VRF_COORDINATOR || vrfConfig.coordinator;
    keyHash = process.env.SEPOLIA_KEY_HASH || vrfConfig.keyHash;
    // subscriptionId 是 uint64，使用小值作为占位符（忽略环境变量，因为可能是无效的大值）
    subscriptionId = 1n;
    callbackGasLimit = parseInt(process.env.SEPOLIA_CALLBACK_GAS_LIMIT || process.env.MAINNET_CALLBACK_GAS_LIMIT || vrfConfig.callbackGasLimit);
    requestConfirmations = parseInt(process.env.SEPOLIA_REQUEST_CONFIRMATIONS || process.env.MAINNET_REQUEST_CONFIRMATIONS || vrfConfig.requestConfirmations);
  }

  // VRF v2.5 使用 uint256 作为 subscriptionId，可以是任意大小的数字
  // 只验证不为 0
  if (subscriptionId === 0n) {
    throw new Error(
      `❌ Invalid subscriptionId: ${subscriptionId}\n` +
      `   Subscription ID cannot be 0\n\n` +
      `📖 How to get your Subscription ID:\n` +
      `   1. Visit https://vrf.chain.link/${networkName === "sepolia" ? "sepolia" : networkName === "mainnet" ? "" : "sepolia"}\n` +
      `   2. Connect your wallet (top right corner)\n` +
      `   3. Click "Create Subscription" to create a new subscription\n` +
      `   4. After creation, find your subscription in "My Subscriptions" list\n` +
      `   5. Click on the Subscription ID to view details\n` +
      `   6. Copy the Subscription ID from the wallet signature message or subscription details\n\n` +
      `💡 Example: Set your subscription ID:\n` +
      `   export SEPOLIA_SUBSCRIPTION_ID=56844506921699579036306656104852111530731083107608357020002801268108910808470`
    );
  }

  // VRF v2.5 支持原生代币支付（nativePayment）
  // 如果设置为 true，使用原生代币（ETH）支付；如果为 false，使用 LINK 代币支付
  let nativePayment: boolean;
  if (networkName === "sepolia") {
    nativePayment = process.env.SEPOLIA_VRF_NATIVE_PAYMENT === "true" || deploymentConfig.vrf.sepolia.nativePayment || true;
  } else if (networkName === "mainnet") {
    nativePayment = process.env.MAINNET_VRF_NATIVE_PAYMENT === "true" || deploymentConfig.vrf.mainnet.nativePayment || true;
  } else {
    nativePayment = process.env.VRF_NATIVE_PAYMENT === "true" || deploymentConfig.vrf.localhost.nativePayment || true;
  }

  if (!vrfCoordinator || !keyHash || subscriptionId === 0n) {
    throw new Error("VRF configuration missing. Please set VRF_COORDINATOR, KEY_HASH, and SUBSCRIPTION_ID in .env");
  }

  // 部署SaleManager
  console.log("\n=== Deploying SaleManager ===");
  const SaleManager = await ethers.getContractFactory("SaleManager");
  const saleManagerProxy = await deployUUPSProxy(
    SaleManager,
    [
      ethers.parseEther(salePrice),
      BigInt(maxPerWallet),
    ],
    deployer,
    ethers
  );
  const saleManagerAddress = await saleManagerProxy.getAddress();
  console.log("SaleManager deployed at:", saleManagerAddress);

  // 部署VRFHandler (VRF v2.5)
  console.log("\n=== Deploying VRFHandler (VRF v2.5) ===");
  console.log("VRF Coordinator:", vrfCoordinator);
  console.log("Key Hash:", keyHash);
  console.log("Subscription ID:", subscriptionId.toString());
  console.log("Native Payment:", nativePayment ? "true (使用原生代币)" : "false (使用LINK代币)");
  const VRFHandler = await ethers.getContractFactory("VRFHandler");

  // VRF v2.5 使用 uint256 作为 subscriptionId，直接传递 bigint
  // initialize 参数: (vrfCoordinator, keyHash, subscriptionId, callbackGasLimit, requestConfirmations, nativePayment)
  const vrfHandlerProxy = await deployUUPSProxy(
    VRFHandler,
    [vrfCoordinator, keyHash, subscriptionId, callbackGasLimit, requestConfirmations, nativePayment],
    deployer,
    ethers
  );
  const vrfHandlerAddress = await vrfHandlerProxy.getAddress();
  console.log("VRFHandler deployed at:", vrfHandlerAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("SaleManager:", saleManagerAddress);
  console.log("VRFHandler:", vrfHandlerAddress);

  console.log("\n💡 Next steps:");
  console.log("1. Set environment variables:");
  console.log(`   export SALE_MANAGER_ADDRESS=${saleManagerAddress}`);
  console.log(`   export VRF_HANDLER_ADDRESS=${vrfHandlerAddress}`);
  console.log("2. Deploy NFTBlindBoxUpgradeable with these module addresses");
  console.log("3. Transfer ownership of modules to NFTBlindBox if needed");
  console.log("4. Configure VRF settings in VRFHandler (if needed)");

  return {
    saleManager: saleManagerAddress,
    vrfHandler: vrfHandlerAddress,
  };
}

main()
  .then((result) => {
    console.log("\nModule deployment successful!");
    console.log("SaleManager:", result.saleManager);
    console.log("VRFHandler:", result.vrfHandler);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n Deployment failed:");
    console.error(error);
    process.exit(1);
  });

