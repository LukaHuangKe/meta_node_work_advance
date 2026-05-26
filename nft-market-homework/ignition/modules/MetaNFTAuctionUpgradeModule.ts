/**
 * MetaNFTAuction 合约升级模块
 * 作用：将已部署的 MetaNFTAuction 代理合约从 V1 版本升级到 V2 版本
 * 功能：
 *   1. 复用之前部署好的代理和 ProxyAdmin
 *   2. 部署新版本的实现合约 MetaNFTAuctionV2
 *   3. 调用 upgradeAndCall 执行升级
 *   4. 返回升级后的合约对象
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MetaNFTAuctionModule from "./MetaNFTAuctionProxyModule.js";

const metaNFTAuctionUpgradeModule = buildModule(
  "MetaNFTAuctionUpgradeModule",  // 模块ID
  (m) => {
    // 获取第0个账户作为 ProxyAdmin 的所有者
    const proxyAdminOwner = m.getAccount(0);

    // 复用之前部署好的 MetaNFTAuctionModule，获取代理和 ProxyAdmin
    // const { proxyAdmin, proxy } = m.useModule(MetaNFTAuctionModule);

    // 需要把之前已经部署好的 proxyAdmin 和 proxy 地址传入，才能真正的升级原合约
    // 通过参数获取已部署好的 proxyAdmin 地址
    const proxyAdminAddress = process.env.PROXY_ADMIN_ADDRESS;
    // 通过参数获取已部署好的 proxy 地址
    const proxyAddress = process.env.PROXY_ADDRESS;

    // 确保地址都有值，否则抛出错误
    if (!proxyAdminAddress || !proxyAddress) {
      throw new Error(
          "请在 .env 文件中设置 PROXY_ADDRESS 和 PROXY_ADMIN_ADDRESS"
      );
    }

    // 用 contractAt 引用已部署好的 ProxyAdmin 合约，而不是重新部署
    const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress as string);
    // 用 contractAt 引用已部署好的代理合约，而不是重新部署
    const proxy = m.contractAt("TransparentUpgradeableProxy", proxyAddress as string);

    // 部署新版本的实现合约 MetaNFTAuctionV2
    const auctionV2 = m.contract("MetaNFTAuctionV2");

    // 调用 ProxyAdmin 的 upgradeAndCall 方法执行升级
    // 参数说明：
    // 1. proxyAdmin：要调用的合约对象（ProxyAdmin 合约）
    // 2. "upgradeAndCall"：要调用的合约函数名
    // 3. [proxy, auctionV2,"0x"]：函数参数，依次是：
    //    - proxy：要升级的代理合约地址
    //    - auctionV2：新的实现合约地址
    //    - "0x"：升级后调用的额外数据（空表示不调用）
    m.call(proxyAdmin, "upgradeAndCall", [proxy, auctionV2,"0x"], {
      from: proxyAdminOwner,  // 由 ProxyAdmin 所有者发起调用
    });

    // 用 MetaNFTAuctionV2 的 ABI 包装代理地址，方便后续调用升级后的合约
    const auction = m.contractAt("MetaNFTAuctionV2", proxy, {
      id: "MetaNFTAuctionV2AtProxy",  // 给这个 future 一个唯一ID
    });

    // 返回升级后的合约对象、ProxyAdmin 和代理地址
    return { auction, proxyAdmin, proxy };
  },
);

export default metaNFTAuctionUpgradeModule;
