import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig,task } from "hardhat/config";
import HardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, HardhatIgnitionEthersPlugin, hardhatKeystore, hardhatViem],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
    /** *
     * 默认情况下，Hardhat 只编译你项目 contracts/ 目录下的 .sol 文件。
     * 如果你希望将 node_modules 中某个 npm 包的 Solidity 文件也纳入编译（生成 ABI、Bytecode 等），就通过这个选项来指定。
     * 在你的项目中使用 透明代理模式 （Transparent Upgradeable Proxy）部署合约时：
     - 你的 Ignition 部署模块 MetaNFTAuctionProxyModule.ts 中直接引用了 TransparentUpgradeableProxy 和 ProxyAdmin
     - Hardhat Ignition 需要这些合约的 ABI 才能正确编码部署参数和管理代理
     - 如果不配置 npmFilesToBuild ，这些合约即使存在于 node_modules 中，也不会被编译成 artifacts，Ignition 就无法引用
     */
    npmFilesToBuild: [
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
    ],
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      // url: configVariable("SEPOLIA_RPC_URL"),
      // accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
      timeout: 120000, // 120 秒超时
    },
  },
  verify: {
    etherscan: {
      // apiKey: configVariable("SEPOLIA_ETHERSCAN_API_KEY"),
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    }}
});
