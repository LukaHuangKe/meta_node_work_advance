import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-typechain";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 辅助函数：检查私钥是否有效
function isValidPrivateKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  // 检查是否是占位符
  if (trimmed.includes("your_") || trimmed.includes("_here") || trimmed === "") {
    return false;
  }
  // 检查是否是有效的十六进制私钥（64个字符，可选0x前缀）
  const hexPattern = /^(0x)?[0-9a-fA-F]{64}$/;
  return hexPattern.test(trimmed);
}

// hardhat-gas-reporter 和 solidity-coverage 可能不兼容 Hardhat 3.0，暂时注释
// import "hardhat-gas-reporter";
// import "solidity-coverage";
// @openzeppelin/hardhat-upgrades 目前不支持 Hardhat 3.0
// 暂时移除，等待官方更新
// import "@openzeppelin/hardhat-upgrades";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatIgnitionPlugin],
  // Mocha 配置通过插件自动处理，无需在此处配置
  // 如需自定义超时时间，可以在测试文件中使用 mocha.timeout() 或在命令行使用 --timeout 参数
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
    // 本地 Hardhat 网络（EDR 模拟）
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    // 本地节点网络
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Sepolia 测试网
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "",
      ...(isValidPrivateKey(process.env.SEPOLIA_PRIVATE_KEY) && {
        accounts: [process.env.SEPOLIA_PRIVATE_KEY!],
      }),
      chainId: 11155111,
      timeout: 120000, // 120 秒超时
      httpHeaders: {},
    },
    // 主网
    mainnet: {
      type: "http",
      chainType: "l1",
      url: process.env.MAINNET_RPC_URL || "",
      ...(isValidPrivateKey(process.env.MAINNET_PRIVATE_KEY) && {
        accounts: [process.env.MAINNET_PRIVATE_KEY!],
      }),
      chainId: 1,
      timeout: 120000,
      httpHeaders: {},
    },
  },
  // Etherscan 验证配置
  // @ts-ignore - etherscan config is valid but not in type definition
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  // OpenZeppelin Upgrades 插件配置
  // 注意：透明代理模式是默认模式，无需额外配置
});