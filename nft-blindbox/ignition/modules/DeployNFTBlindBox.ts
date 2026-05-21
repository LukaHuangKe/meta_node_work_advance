import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * NFT盲盒部署模块（仅部署实现合约）
 * 
 * 注意：由于Ignition和OpenZeppelin Upgrades插件的集成限制，
 * 推荐使用 scripts/deployWithUUPS.ts 进行完整部署。
 * 
 * 这个模块仅用于部署实现合约，代理部署请使用OpenZeppelin Upgrades插件。
 */
const DeployNFTBlindBoxModule = buildModule("DeployNFTBlindBox", (m) => {
  // 获取部署参数
  const name = m.getParameter<string>("name", "Mystery NFT");
  const symbol = m.getParameter<string>("symbol", "MNFT");
  const maxSupply = m.getParameter<bigint>("maxSupply", 10000n);
  const price = m.getParameter<bigint>("price", 80000000000000000n); // 0.08 ETH

  // 部署实现合约
  // 注意：这个实现合约不包含初始化逻辑，需要通过代理的initialize函数初始化
  const implementation = m.contract("NFTBlindBoxUpgradeable", {
    id: "NFTBlindBoxImplementation",
  });

  // 返回部署结果
  // 实际使用时，需要通过OpenZeppelin Upgrades插件部署代理
  return { implementation, name, symbol, maxSupply, price };
});

export default DeployNFTBlindBoxModule;

