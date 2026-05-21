// @ts-ignore - Hardhat 3 模块解析需要 node16，但类型检查可能有问题
import { defineConfig } from "hardhat/config";
// @ts-ignore
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-typechain";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
// @ts-ignore
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

const config = defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatIgnitionPlugin],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 120000,
      httpHeaders: {},
    },
    mainnet: {
      type: "http",
      chainType: "l1",
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
      timeout: 120000,
      httpHeaders: {},
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  // OpenZeppelin Upgrades 插件配置
  // 注意：UUPS代理模式需要指定kind: "uups"
});

// 部署配置（作为 fallback，优先使用环境变量）
export const deploymentConfig = {
  // 销售配置
  sale: {
    price: process.env.SALE_PRICE || "0.08",
    maxPerWallet: process.env.SALE_MAX_PER_WALLET || "10",
  },
  // VRF v2.5 配置
  vrf: {
    sepolia: {
      coordinator: process.env.SEPOLIA_VRF_COORDINATOR || "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
      // VRF v2.5 在 Sepolia 上最低费用的 keyHash 是 200 Gwei
      // 参考：https://docs.chain.link/vrf/v2-5/overview/subscription
      keyHash: process.env.SEPOLIA_KEY_HASH || "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 200 Gwei（最低费用）
      subscriptionId: process.env.SEPOLIA_SUBSCRIPTION_ID || "0",
      callbackGasLimit: process.env.SEPOLIA_CALLBACK_GAS_LIMIT || "2500000",
      requestConfirmations: process.env.SEPOLIA_REQUEST_CONFIRMATIONS || "3",
      nativePayment: process.env.SEPOLIA_VRF_NATIVE_PAYMENT === "true" || false, // VRF v2.5 支持原生代币支付
    },
    mainnet: {
      coordinator: process.env.MAINNET_VRF_COORDINATOR || "",
      keyHash: process.env.MAINNET_KEY_HASH || "",
      subscriptionId: process.env.MAINNET_SUBSCRIPTION_ID || "0",
      callbackGasLimit: process.env.MAINNET_CALLBACK_GAS_LIMIT || "250000",
      requestConfirmations: process.env.MAINNET_REQUEST_CONFIRMATIONS || "3",
      nativePayment: process.env.MAINNET_VRF_NATIVE_PAYMENT === "true" || false, // VRF v2.5 支持原生代币支付
    },
    localhost: {
      coordinator: process.env.SEPOLIA_VRF_COORDINATOR || "0x0000000000000000000000000000000000000000",
      keyHash: process.env.SEPOLIA_KEY_HASH || "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
      subscriptionId: "1", // localhost 使用占位符
      callbackGasLimit: "250000",
      requestConfirmations: "3",
      nativePayment: false, // localhost 默认使用 LINK
    },
  },
};

export default config;
