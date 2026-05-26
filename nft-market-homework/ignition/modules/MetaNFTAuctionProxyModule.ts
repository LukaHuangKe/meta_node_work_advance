// 导入 Hardhat Ignition 的 buildModule 函数，用于创建部署模块
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// 创建第一个子模块：部署代理和实现合约
const metaNFTAuctionProxyModule = buildModule(
  "MetaNFTAuctionProxyModule", // 模块名称，用于标识
  (m) => { // m 是 Ignition 的模块构建对象，提供各种部署方法
    // 获取第0个账户（通常是部署者账户）作为代理管理员
    const proxyAdminOwner = m.getAccount(0);

    // 部署 MetaNFTAuction 实现合约
    // m.contract 会发送部署交易，创建新的合约
    const auctionImpl = m.contract("MetaNFTAuction");

    // 编码 initialize 函数调用，用于代理合约的初始化
    // 这样代理部署时可以直接调用 initialize 设置管理员
    const encodedFunctionCall = m.encodeFunctionCall(
      auctionImpl, // 实现合约对象
      "initialize", // 要调用的函数名
      [proxyAdminOwner], // 函数参数：管理员地址
    );

    // 部署 TransparentUpgradeableProxy 透明代理合约
    const proxy = m.contract("TransparentUpgradeableProxy", [
      auctionImpl, // 参数1：实现合约地址
      proxyAdminOwner, // 参数2：代理管理员地址
      encodedFunctionCall, // 参数3：初始化函数调用数据
    ]);

    // 从代理合约的 AdminChanged 事件中读取 ProxyAdmin 的地址
    // TransparentUpgradeableProxy 部署时会自动创建 ProxyAdmin，我们需要捕获这个地址
    const proxyAdminAddress = m.readEventArgument(
      proxy, // 监听哪个合约的事件
      "AdminChanged", // 事件名称
      "newAdmin", // 事件中的哪个参数。一次只能读取一个参数，但可以多次调用来获取其他参数
    );

    // 用 ProxyAdmin 的 ABI 包装刚才获取的地址
    // m.contractAt 不会部署新合约，只是引用已存在的合约
    const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

    // 返回这两个重要的合约对象，供其他模块使用
    return { proxyAdmin, proxy };
  },
);

// 创建第二个主模块，包装上面的子模块，方便使用
const metaNFTAuctionModule = buildModule("MetaNFTAuctionModule", (m) => {
  // 复用上面的子模块，获取 proxy 和 proxyAdmin
  const { proxy, proxyAdmin } = m.useModule(metaNFTAuctionProxyModule);

  // 把代理合约地址用 MetaNFTAuction 的 ABI 包装起来
  // 这样我们就可以像直接调用 MetaNFTAuction 一样调用代理合约
  const auction = m.contractAt("MetaNFTAuction", proxy);

  // 返回三个合约对象，供部署后使用。auction, proxy地址其实是一样的
  return { auction, proxy, proxyAdmin };
});

// 导出主模块作为默认导出，这是 Ignition 部署时会使用的模块
export default metaNFTAuctionModule;
