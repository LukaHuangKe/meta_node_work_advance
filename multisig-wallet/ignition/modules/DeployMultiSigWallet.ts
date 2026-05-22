import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * 多签钱包部署模块（使用 OpenZeppelin Upgrades 插件）
 *
 * 注意：这个模块部署实现合约，实际的代理部署和升级通过单独的脚本处理
 * 这样可以更好地利用 OpenZeppelin Upgrades 插件的功能
 *
 * 可升级合约没有构造函数，所以直接部署即可。
 */
// 这个合约在script脚本里被引用了
const DeployMultiSigWalletModule = buildModule("DeployMultiSigWallet", (m) => {
    // 部署实现合约
    // MultiSigWalletUpgradeable 是可升级合约，没有构造函数，所以不需要传递参数
    // 初始化逻辑通过 initialize 函数在代理部署时调用
    const implementation = m.contract("MultiSigWalletUpgradeable", [], {
        id: "MultiSigWalletImplementation",
    });

    return {
        implementation,
    };
});

export default DeployMultiSigWalletModule;