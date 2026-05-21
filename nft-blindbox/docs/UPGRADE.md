# NFT盲盒升级指南

本文档说明如何使用UUPS代理模式部署和升级NFT盲盒合约。

## 目录

- [概述](#概述)
- [项目结构](#项目结构)
- [部署方式](#部署方式)
- [升级流程](#升级流程)
- [安全注意事项](#安全注意事项)

## 概述

本项目使用 **OpenZeppelin 的UUPS代理模式（UUPS Proxy Pattern）** 实现合约升级功能。

### 代理模式架构

```
用户调用
   ↓
UUPS Proxy Contract (代理合约)
   ↓
Implementation Contract (实现合约)
   ├── 升级逻辑（upgrade函数）
   └── 业务逻辑
```

- **代理合约（Proxy）**：存储状态变量，用户直接交互的对象
- **实现合约（Implementation）**：包含业务逻辑和升级逻辑，可以被升级替换
- **升级权限**：由实现合约的owner控制（不是独立的ProxyAdmin）

### UUPS模式特点

1. **升级逻辑在实现合约中**：实现合约继承UUPSUpgradeable
2. **无需ProxyAdmin**：不需要单独的管理员合约
3. **更节省Gas**：比透明代理模式更高效
4. **安全性**：升级权限由合约owner控制

## 项目结构

```
contracts/
├── NFTBlindBoxUpgradeable.sol   # 可升级版本（V1）
└── NFTBlindBoxV2.sol            # 升级版本（V2，演示用）

scripts/
├── deployWithUUPS.ts            # 使用UUPS代理部署
├── upgrade.ts                   # 升级合约脚本
└── prepareUpgrade.ts            # 准备升级（验证）

ignition/
└── modules/
    └── DeployNFTBlindBox.ts     # Ignition 部署模块
```

## 部署方式

### 使用UUPS代理部署（推荐）

```bash
# 部署代理合约
npx hardhat run scripts/deployWithUUPS.ts --network localhost
```

这个脚本会：
1. 部署实现合约（Implementation）
2. 部署UUPS代理合约（Proxy）
3. 通过代理调用initialize函数初始化
4. 返回代理地址和实现地址

**输出示例：**
```
Deploying NFTBlindBox with UUPS Proxy...
Proxy Address: xxxxxxxx
Implementation Address: xxxxxxxx
```

## 升级流程

### 步骤1：准备升级

在正式升级前，先验证新版本合约：

```bash
PROXY_ADDRESS=xxxxxxxx \
npx hardhat run scripts/prepareUpgrade.ts --network localhost
```

这会：
- 编译新版本合约
- 验证存储布局兼容性
- 返回新实现合约地址（但不部署）

### 步骤2：执行升级

```bash
PROXY_ADDRESS=xxxxxxxx \
npx hardhat run scripts/upgrade.ts --network localhost
```

这会：
1. 部署新的实现合约（NFTBlindBoxV2）
2. 调用代理的upgradeTo函数更新实现地址
3. 调用V2的initializeV2函数（如果需要）

### 步骤3：验证升级

升级后，验证新功能：

```typescript
const blindBox = await ethers.getContractAt("NFTBlindBoxV2", proxyAddress);
const version = await blindBox.version(); // 应该返回 2
const [common, rare, epic, legendary] = await blindBox.getAllRarityCounts();
```

## 升级规则和最佳实践

### 存储布局规则

升级时必须遵循以下规则：

1. **可以添加新的状态变量（在末尾）**
   ```solidity
   // ✅ 可以添加
   uint256 public version;
   mapping(address => uint256) public userPurchaseCount;
   ```

2. **不能删除状态变量**
   ```solidity
   // ❌ 不能删除
   // uint256 public totalSupply; // 已删除
   ```

3. **不能改变变量类型**
   ```solidity
   // ❌ 不能改变类型
   // uint256 public maxSupply; // 原来是 uint256
   // uint32 public maxSupply;  // 不能改成 uint32
   ```

4. **不能改变变量顺序**
   ```solidity
   // ❌ 不能改变顺序
   // uint256 public totalSupply;
   // uint256 public maxSupply;
   ```

5. **新变量必须添加在末尾**
   ```solidity
   // ✅ 新变量在末尾
   uint256[50] private __gap; // 存储间隙，用于未来升级
   ```

### 初始化函数

升级时可以使用 `reinitializer`：

```solidity
function initializeV2(uint256 _version) public reinitializer(2) {
    version = _version;
}
```

### 安全注意事项

1. **测试升级流程**
   - 在测试网充分测试
   - 验证所有功能正常
   - 检查状态变量是否正确迁移

2. **备份重要数据**
   - 备份代理地址
   - 记录所有状态变量
   - 保存配置参数

3. **权限管理**
   - owner的私钥必须安全保存
   - 考虑使用多签钱包管理owner

4. **升级前检查清单**
   - [ ] 新合约代码已审计
   - [ ] 存储布局兼容性已验证
   - [ ] 在测试网成功升级
   - [ ] 备份了所有重要信息
   - [ ] 升级脚本已测试

## 示例：从V1升级到V2

### V1合约（NFTBlindBoxUpgradeable.sol）

```solidity
contract NFTBlindBoxUpgradeable is 
    Initializable, 
    ERC721Upgradeable, 
    OwnableUpgradeable,
    UUPSUpgradeable 
{
    uint256 public totalSupply;
    uint256 public maxSupply;
    mapping(uint256 => Rarity) public tokenRarity;
    // ... 其他状态变量
}
```

### V2合约（NFTBlindBoxV2.sol）

```solidity
contract NFTBlindBoxV2 is NFTBlindBoxUpgradeable {
    uint256 public version; // 新增变量
    mapping(address => uint256) public userPurchaseCount; // 新增变量
    mapping(uint256 => uint256) public rarityCount; // 新增变量
    
    function initializeV2(uint256 _version) public reinitializer(2) {
        version = _version;
    }
    
    // 新功能
    function getUserPurchaseCount(address user) public view returns (uint256) {
        return userPurchaseCount[user];
    }
    
    function getAllRarityCounts() public view returns (...) {
        // 返回所有稀有度统计
    }
}
```

### 升级步骤

```bash
# 1. 准备升级
PROXY_ADDRESS=0x... npx hardhat run scripts/prepareUpgrade.ts

# 2. 执行升级
PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.ts

# 3. 验证
npx hardhat console
> const blindBox = await ethers.getContractAt("NFTBlindBoxV2", "0x...")
> await blindBox.version() // 应该返回 2n
```

## 常见问题

### Q1: 升级后代理地址会变吗？

**A:** 不会。代理地址保持不变，只有实现合约地址会改变。

### Q2: 升级后状态会丢失吗？

**A:** 不会。状态存储在代理合约中，升级不会影响状态。

### Q3: 如何回滚到旧版本？

**A:** 可以再次升级回旧版本的实现合约，但需要确保存储布局兼容。

### Q4: 谁可以执行升级？

**A:** 只有合约的owner可以执行升级（通过_authorizeUpgrade函数）。

### Q5: UUPS和透明代理有什么区别？

**A:** 
- UUPS：升级逻辑在实现合约中，不需要ProxyAdmin，更节省Gas
- 透明代理：升级逻辑在ProxyAdmin中，需要额外的ProxyAdmin合约

### Q6: 可以在升级时修改构造函数参数吗？

**A:** 不可以。代理合约已经初始化，只能通过初始化函数修改（使用reinitializer）。

## 参考资源

- [OpenZeppelin Upgrades 文档](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [UUPS代理模式](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies#uups-proxies)
- [存储布局规则](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable)

