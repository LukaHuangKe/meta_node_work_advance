/**
 * MetaNFTAuctionUUPS 合约部署模块
 * 作用：部署使用 UUPS 代理模式的 MetaNFTAuctionUUPS 合约
 * 功能：
 *   1. 部署实现合约 MetaNFTAuctionUUPS
 *   2. 部署 ERC1967Proxy 代理合约
 *   3. 调用 initialize 函数进行初始化
 *   4. 返回代理合约和实现合约地址
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const metaNFTAuctionUUPSModule = buildModule(
  "MetaNFTAuctionUUPSModule",  // 模块ID
  (m) => {
    // 获取第0个账户作为合约所有者
    const owner = m.getAccount(0);

    // 部署实现合约 MetaNFTAuctionUUPS
    const implementation = m.contract("MetaNFTAuctionUUPS");

    // 编码初始化函数调用（调用 initialize(owner)）
    const initData = m.encodeFunctionCall(
      implementation,
      "initialize",
      [owner]  // 参数：合约所有者
    );

    // 部署 ERC1967Proxy 代理合约，指向实现合约并执行初始化
    const proxy = m.contract("ERC1967Proxy", [
      implementation,  // 指向的实现合约地址
      initData         // 初始化调用数据
    ]);

    // 用 MetaNFTAuctionUUPS 的 ABI 包装代理地址，方便后续调用
    const auction = m.contractAt("MetaNFTAuctionUUPS", proxy, {
      id: "MetaNFTAuctionUUPSAtProxy",  // 给这个 future 一个唯一ID
    });

    // 返回：代理合约、实现合约
    return { auction, proxy, implementation };
  },
);

export default metaNFTAuctionUUPSModule;
