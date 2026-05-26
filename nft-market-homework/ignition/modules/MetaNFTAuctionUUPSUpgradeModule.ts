/**
 * 这个升级脚本感觉有点问题？
 * MetaNFTAuctionUUPS 合约升级模块
 * 作用：将已部署的 MetaNFTAuctionUUPS 代理合约从 V1 版本升级到 V2 版本
 * 功能：
 *   1. 从 .env 或参数获取已部署好的代理地址
 *   2. 部署新版本的实现合约 MetaNFTAuctionUUPS_V2
 *   3. 调用 upgradeToAndCall 执行升级
 *   4. 返回升级后的合约对象和实现合约
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const metaNFTAuctionUUPSUpgradeModule = buildModule(
  "MetaNFTAuctionUUPSUpgradeModule",  // 模块ID
  (m) => {
    // 获取第0个账户作为合约所有者（升级需要 owner 权限）
    const owner = m.getAccount(0);

    // 获取已部署好的代理地址
    // 从环境变量获取
    // let proxyAddress = process.env.UUPS_PROXY_ADDRESS;
    const proxyAddress = "0xF8f8E9e82E7962EA81ef23CD052c3a4FF2947115";

    // 确保地址有值，否则抛出错误
    if (!proxyAddress) {
      throw new Error(
        "请在 .env 文件中设置 UUPS_PROXY_ADDRESS"
      );
    }

    // 用 contractAt 引用已部署好的代理合约，用 V1 的 ABI 包装
    const proxy = m.contractAt("MetaNFTAuctionUUPS", proxyAddress);

    // 部署新版本的实现合约 MetaNFTAuctionUUPS_V2
    const implementationV2 = m.contract("MetaNFTAuctionUUPS_V2");

    // 调用代理合约的 upgradeToAndCall 方法执行升级
    // UUPS 模式下，直接在代理上调用升级函数（因为代理会 delegatecall 到实现合约）
    m.call(proxy, "upgradeToAndCall", [
      implementationV2,  // 参数1：新的实现合约地址
      "0x"               // 参数2：升级后调用的额外数据（空表示不调用）
    ], {
      from: owner,  // 由合约所有者发起调用（onlyOwner 修饰）
    });

    // 用 V2 的 ABI 包装代理地址，方便后续调用升级后的合约
    const auctionV2 = m.contractAt("MetaNFTAuctionUUPS_V2", proxyAddress, {
      id: "MetaNFTAuctionUUPS_V2AtProxy",  // 给这个 future 一个唯一ID
    });

    // 返回升级后的合约对象、代理合约对象、新的实现合约
    return { auctionV2, proxy, implementationV2 };
  },
);

export default metaNFTAuctionUUPSUpgradeModule;
