# 多签钱包部署指南

本文档详细说明如何部署和升级多签钱包合约。

## 目录

- [脚本文件说明](#脚本文件说明)
- [初次部署](#初次部署)
- [合约升级](#合约升级)
- [部署地址管理](#部署地址管理)
- [常见问题](#常见问题)

---

## 脚本文件说明

`scripts/` 目录下包含以下部署脚本：

| 脚本文件 | 用途 | 是否支持升级 | 推荐场景 |
|---------|------|------------|---------|
| `deploy.ts` | 部署不可升级版本 | 不支持 | 仅用于测试，不推荐生产环境 |
| `deployWithProxy.ts` | **部署可升级版本（推荐）** | 支持 | **生产环境首选** |
| `deployWithIgnition.ts` | 使用 Ignition 部署可升级版本 | 支持 | 需要 Ignition 管理部署时使用 |
| `prepareUpgrade.ts` | 准备升级（验证新版本） | - | 升级前验证 |
| `upgrade.ts` | 执行合约升级 | - | 升级时使用 |

### 脚本选择建议

- **初次部署（生产环境）**：使用 `deployWithProxy.ts`
- **初次部署（需要 Ignition）**：使用 `deployWithIgnition.ts`
- **测试/开发**：可以使用 `deploy.ts`（但无法升级）

---

## 初次部署

### 前置准备

1. **安装依赖**
   ```bash
   npm install
   ```

2. **编译合约**
   ```bash
   npm run compile
   ```

3. **配置网络**（可选）
   
   编辑 `hardhat.config.ts` 添加网络配置，例如：
   ```typescript
   networks: {
     sepolia: {
       type: "http",
       chainType: "l1",
       url: process.env.SEPOLIA_RPC_URL || "",
       accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
     },
   }
   ```

### 方式一：使用代理部署（推荐）

这是**生产环境推荐的方式**，支持后续升级。

#### 命令

```bash
# 本地网络
npm run deploy:proxy
# 或
npx hardhat run scripts/deployWithProxy.ts --network localhost

# Sepolia 测试网
npx hardhat run scripts/deployWithProxy.ts --network sepolia

# 主网（请谨慎操作）
npx hardhat run scripts/deployWithProxy.ts --network mainnet
```

#### 部署流程

脚本会自动执行以下步骤：

1. **部署实现合约** (Implementation)
   - 部署 `MultiSigWalletUpgradeable` 合约
   - 这是实际的业务逻辑合约

2. **部署 ProxyAdmin**
   - 部署 OpenZeppelin 的 `ProxyAdmin` 合约
   - 用于管理代理合约的升级权限

3. **准备初始化数据**
   - 编码 `initialize` 函数的调用数据
   - 包含所有者和确认阈值参数

4. **部署透明代理** (TransparentUpgradeableProxy)
   - 部署代理合约，指向实现合约
   - 自动调用初始化函数

#### 输出示例

```
Deploying MultiSigWallet with Transparent Proxy...
Deployer: 0x1234...
Owners: [0x5678..., 0x9abc..., 0xdef0...]
Required confirmations: 2

[1/4] Deploying implementation contract...
Implementation deployed at: 0x1111...

[2/4] Deploying ProxyAdmin...
ProxyAdmin deployed at: 0x2222...

[3/4] Preparing initialization data...
Initialization data prepared

[4/4] Deploying TransparentUpgradeableProxy...
Proxy deployed at: 0x3333...

=== Verifying Deployment ===
Proxy Address: 0x3333...
Implementation Address: 0x1111...
ProxyAdmin Address: 0x2222...
Owners: [0x5678..., 0x9abc..., 0xdef0...]
Threshold: 2

Deployment successful!

=== Deployment Summary ===
Proxy Address: 0x3333...
Implementation Address: 0x1111...
ProxyAdmin Address: 0x2222...

Save these addresses for future upgrades!
```

#### 重要提示

**请务必保存以下地址：**
- **Proxy Address** (0x3333...): 这是你与合约交互的地址，**永远不变**
- **Implementation Address** (0x1111...): 实现合约地址，升级时会改变
- **ProxyAdmin Address** (0x2222...): 管理员地址，用于执行升级

### 方式二：使用 Ignition 部署

如果你需要使用 Hardhat Ignition 来管理部署状态，可以使用此方式。

#### 命令

```bash
# 使用 Ignition 部署实现合约，然后手动部署代理
npx hardhat run scripts/deployWithIgnition.ts --network localhost
```

#### 流程说明

1. 使用 Ignition 部署实现合约
2. 手动部署 ProxyAdmin
3. 手动部署透明代理
4. 自动初始化

### 方式三：仅测试部署（不推荐生产）

```bash
npm run deploy
# 或
npx hardhat run scripts/deploy.ts --network localhost
```

**注意**：此方式部署的合约**无法升级**，仅用于测试。

---

## 合约升级

当需要升级合约功能时，按照以下流程操作。

### 升级前准备

1. **确保你有 ProxyAdmin 的所有权**
   
   只有 ProxyAdmin 的所有者才能执行升级。检查方法：
   ```bash
   # 在 Hardhat Console 中
   const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
   const admin = ProxyAdmin.attach("0x2222..."); // ProxyAdmin 地址
   const owner = await admin.owner();
   console.log("ProxyAdmin Owner:", owner);
   ```

2. **备份当前状态**
   - 记录当前实现合约地址
   - 记录所有所有者地址
   - 记录当前阈值

### 步骤 1：准备升级（验证）

在正式升级前，先验证新版本合约是否可以安全升级。

#### 命令

```bash
# 设置代理地址
export PROXY_ADDRESS=0x3333...  # 你的代理地址

# 执行验证
npm run prepare:upgrade
# 或
npx hardhat run scripts/prepareUpgrade.ts --network sepolia
```

#### 功能说明

脚本会执行以下操作：

1. **读取当前实现地址**
   - 从代理合约的存储槽中读取当前实现地址

2. **读取 ProxyAdmin 地址**
   - 确认管理员地址

3. **部署新实现合约**
   - 部署 `MultiSigWalletV2` 合约（仅用于验证，不实际升级）

4. **验证合约可调用性**
   - 检查新合约是否可以正常调用

#### 输出示例

```
Preparing upgrade...
Proxy Address: 0x3333...
Current Implementation Address: 0x1111...
ProxyAdmin Address: 0x2222...

[1/2] Deploying new implementation contract...
New implementation deployed at: 0x4444...

[2/2] Verifying storage layout compatibility...
Note: This is a basic check. For production, use:
   - OpenZeppelin Upgrades Plugin (when available for Hardhat 3.0)
   - Manual storage layout comparison
   - Slither or other security tools
New implementation contract is callable

=== Upgrade Preparation Summary ===
New implementation can be deployed at: 0x4444...
Current Implementation: 0x1111...
ProxyAdmin Address: 0x2222...

Next steps:
1. Review the storage layout compatibility manually
2. Test the new implementation on a testnet first
3. Proceed with upgrade using:
   PROXY_ADDRESS=0x3333... npx hardhat run scripts/upgrade.ts --network sepolia
```

#### 重要检查项

在升级前，请手动检查：

1. **存储布局兼容性**
   - 新版本只能**添加**新的状态变量（在末尾）
   - **不能删除**状态变量
   - **不能改变**变量类型
   - **不能改变**变量顺序

2. **功能兼容性**
   - 确保新版本不会破坏现有功能
   - 测试新功能是否正常工作

3. **在测试网验证**
   - 先在测试网（如 Sepolia）上测试升级流程
   - 验证所有功能正常后再在主网升级

### 步骤 2：执行升级

验证通过后，执行实际升级。

#### 命令

```bash
# 设置代理地址
export PROXY_ADDRESS=0x3333...  # 你的代理地址

# 执行升级
npm run upgrade
# 或
npx hardhat run scripts/upgrade.ts --network sepolia
```

#### 功能说明

脚本会执行以下操作：

1. **部署新实现合约**
   - 部署 `MultiSigWalletV2` 合约

2. **通过 ProxyAdmin 升级代理**
   - 调用 `ProxyAdmin.upgrade()` 方法
   - 将代理指向新的实现合约

3. **初始化 V2 功能**
   - 调用 `initializeV2()` 函数（如果需要）
   - 设置版本号等新功能

4. **验证升级**
   - 确认新实现地址已更新
   - 验证原有功能仍然可用
   - 验证新功能正常工作

#### 输出示例

```
Upgrading MultiSigWallet...
Deployer: 0x1234...
Proxy Address: 0x3333...
Current Implementation Address: 0x1111...
ProxyAdmin Address: 0x2222...

[1/3] Deploying new implementation contract...
New implementation deployed at: 0x4444...

[2/3] Upgrading proxy through ProxyAdmin...
Upgrade transaction hash: 0xaaaa...
Proxy upgraded successfully
Verified: New implementation address matches

[3/3] Initializing V2 features...
Initializing V2 with version 2...
V2 initialization completed

=== Upgrade Verification ===
Proxy Address (unchanged): 0x3333...
New Implementation Address: 0x4444...
Version: 2
Owners count: 3
Threshold: 2
All existing functionality verified

Upgrade successful!

=== Upgrade Summary ===
Proxy Address: 0x3333...
New Implementation Address: 0x4444...
Version: 2
```

#### 重要提示

1. **代理地址不变**
   - 升级后，代理地址（0x3333...）**保持不变**
   - 这是你与合约交互的地址
   - 前端和其他集成无需修改

2. **实现地址改变**
   - 新的实现地址（0x4444...）会替换旧的（0x1111...）
   - 这是正常的，表示升级成功

3. **数据保持不变**
   - 所有存储数据（所有者、交易记录等）都会保留
   - 这是代理模式的优势

---

## 部署地址管理

### 建议的记录方式

创建一个 `deployments.json` 文件记录部署信息：

```json
{
  "network": "sepolia",
  "deploymentDate": "2024-01-01",
  "addresses": {
    "proxy": "0x3333...",
    "implementation": "0x1111...",
    "proxyAdmin": "0x2222..."
  },
  "owners": [
    "0x5678...",
    "0x9abc...",
    "0xdef0..."
  ],
  "threshold": 2,
  "upgrades": [
    {
      "date": "2024-02-01",
      "fromVersion": "1",
      "toVersion": "2",
      "newImplementation": "0x4444..."
    }
  ]
}
```

### 环境变量管理

创建 `.env` 文件（不要提交到 Git）：

```bash
# 网络配置
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
SEPOLIA_PRIVATE_KEY=your_private_key_here

# 部署地址（部署后填写）
PROXY_ADDRESS=0x3333...
IMPLEMENTATION_ADDRESS=0x1111...
PROXY_ADMIN_ADDRESS=0x2222...
```

---

## 常见问题

### Q1: 我应该使用哪个脚本部署？

**A:** 生产环境推荐使用 `deployWithProxy.ts`，它支持后续升级。

### Q2: 升级后代理地址会变吗？

**A:** 不会。代理地址永远不变，只有实现合约地址会改变。

### Q3: 升级会影响现有数据吗？

**A:** 不会。所有存储数据（所有者、交易记录等）都会保留。

### Q4: 谁可以执行升级？

**A:** 只有 ProxyAdmin 的所有者可以执行升级。确保你拥有 ProxyAdmin 的所有权。

### Q5: 如何验证升级是否成功？

**A:** 
1. 检查新实现地址是否已更新
2. 验证原有功能仍然可用
3. 测试新功能是否正常工作

### Q6: 升级失败怎么办？

**A:** 
- 如果升级交易失败，代理仍然指向旧实现，数据不会丢失
- 检查错误信息，修复问题后重试
- 确保 ProxyAdmin 所有者地址正确

### Q7: 可以在测试网先测试吗？

**A:** 强烈建议！先在测试网（如 Sepolia）上完整测试升级流程，确认无误后再在主网执行。

---

## 相关文档

- [README.md](../crowdfunding-platform/README.md) - 项目总体说明
- [README_UPGRADE.md](./README_UPGRADE.md) - 详细升级指南
- [OpenZeppelin Upgrades 文档](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Hardhat 文档](https://hardhat.org/docs)

---

## 快速参考

### 初次部署（推荐）

```bash
# 1. 编译
npm run compile

# 2. 部署（本地）
npm run deploy:proxy

# 3. 保存地址
# 记录 Proxy Address, Implementation Address, ProxyAdmin Address
```

### 升级流程

```bash
# 1. 准备升级（验证）
export PROXY_ADDRESS=0x3333...
npm run prepare:upgrade

# 2. 执行升级
export PROXY_ADDRESS=0x3333...
npm run upgrade

# 3. 验证升级
# 检查版本号和功能是否正常
```

