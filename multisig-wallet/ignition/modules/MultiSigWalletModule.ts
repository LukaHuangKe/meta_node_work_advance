import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * 多签钱包部署模块（仅部署实现合约）
 *
 * 注意：由于 Ignition 和 OpenZeppelin Upgrades 插件的集成限制，
 * 推荐使用 scripts/deployWithProxy.ts 进行完整部署。
 *
 * 这个模块仅用于部署实现合约，代理部署请使用 OpenZeppelin Upgrades 插件。
 *
 * 可升级合约没有构造函数，所以直接部署即可。
 */
const MultiSigWalletModule = buildModule("MultiSigWalletModule", (m) => {
    // 部署实现合约（Implementation Contract）
    // MultiSigWalletUpgradeable 是可升级合约，没有构造函数，所以不需要传递参数
    // 初始化逻辑通过 initialize 函数在代理部署时调用
    const implementation = m.contract("MultiSigWalletUpgradeable", [], {
        id: "MultiSigWalletImplementation",
    });

    // 返回部署结果
    // 实际使用时，需要通过 OpenZeppelin Upgrades 插件部署代理并调用 initialize
    // 注意：owners 和 numConfirmationsRequired 是参数，不需要在返回值中
    return { implementation };
});

export default MultiSigWalletModule;