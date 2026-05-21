# NFT盲盒销售开启指南

## 购买NFT盲盒的操作步骤

### 前置条件

1. **已部署合约**
   - SaleManager 模块已部署
   - NFTBlindBoxUpgradeable 主合约已部署
   - 合约地址已配置在 `.env` 文件中

2. **确认你是合约Owner**
   - SaleManager 的 owner 才能开启销售
   - 检查方法：查看部署脚本的输出，或使用 Hardhat Console

### 方法一：使用脚本开启销售（推荐）

#### 1. 开启公售（任何人都可以购买）

```bash
# 确保环境变量已设置
export SALE_MANAGER_ADDRESS=0x你的SaleManager地址

# 开启公售（默认，推荐）
npx hardhat run scripts/enableSale.ts --network sepolia

# 或使用环境变量明确指定
PHASE=public npx hardhat run scripts/enableSale.ts --network sepolia
```

#### 2. 开启白名单阶段

```bash
PHASE=whitelist npx hardhat run scripts/enableSale.ts --network sepolia
```

#### 3. 停止销售

```bash
PHASE=stop npx hardhat run scripts/enableSale.ts --network sepolia
```

#### 4. 仅开启销售状态（不改变阶段）

```bash
PHASE=active npx hardhat run scripts/enableSale.ts --network sepolia
```

### 方法二：使用 Hardhat Console

```bash
# 启动 Hardhat Console
npx hardhat console --network sepolia

# 在 Console 中执行
const SaleManager = await ethers.getContractFactory("SaleManager");
const saleManager = SaleManager.attach("0x你的SaleManager地址");

// 开启公售
await saleManager.setSalePhase(2);

// 或开启白名单阶段
await saleManager.setSalePhase(1);

// 或仅开启销售状态
await saleManager.setSaleActive(true);
```

### 方法三：使用前端管理界面（如果已实现）

如果前端有管理界面，可以直接在网页上操作。

## 销售阶段说明

### SalePhase 枚举值

- `0` - NotStarted（未开始）
- `1` - Whitelist（白名单阶段）
- `2` - Public（公售阶段）

### 各阶段说明

1. **未开始（NotStarted）**
   - 销售未开启，无法购买
   - 可以添加白名单

2. **白名单阶段（Whitelist）**
   - 只有白名单地址可以购买
   - 每个白名单地址最多购买 3 个
   - 需要先调用 `addToWhitelist` 添加白名单

3. **公售阶段（Public）**
   - 任何人都可以购买
   - 每个钱包最多购买 `maxPerWallet` 个（默认 10 个）

## 完整操作流程示例

### 1. 部署合约（如果还未部署）

```bash
# 部署模块
npx hardhat run scripts/deployModules.ts --network sepolia

# 部署主合约
npx hardhat run scripts/deployWithUUPS.ts --network sepolia
```

### 2. 配置环境变量

在 `.env` 文件中设置：
```bash
SALE_MANAGER_ADDRESS=0x你的SaleManager地址
PROXY_ADDRESS=0x你的代理合约地址
```

### 3. 开启销售

```bash
# 开启公售（推荐）
npx hardhat run scripts/enableSale.ts --network sepolia

# 或者开启白名单阶段
npx hardhat run scripts/enableSale.ts --network sepolia whitelist
```

### 4. 添加白名单（如果使用白名单阶段）

```bash
# 使用 Hardhat Console
npx hardhat console --network sepolia

# 在 Console 中
const SaleManager = await ethers.getContractFactory("SaleManager");
const saleManager = SaleManager.attach("0x你的SaleManager地址");
await saleManager.addToWhitelist(["0x地址1", "0x地址2"]);
```

### 5. 在前端购买

1. 连接钱包
2. 切换到正确的网络（Sepolia 或 Mainnet）
3. 点击"立即购买"按钮
4. 确认交易
5. 等待交易确认

## 常见问题

### Q: 为什么显示"未开售"？

A: 需要调用 `setSalePhase(2)` 或 `setSaleActive(true)` 开启销售。

### Q: 如何检查销售状态？

A: 使用 Hardhat Console：
```javascript
const saleManager = SaleManager.attach("0x地址");
await saleManager.saleActive(); // 返回 true/false
await saleManager.currentPhase(); // 返回 0/1/2
```

### Q: 如何修改价格？

A: 使用 Hardhat Console：
```javascript
await saleManager.setPrice(ethers.parseEther("0.1")); // 设置为 0.1 ETH
```

### Q: 如何修改每个钱包最大购买数？

A: 使用 Hardhat Console：
```javascript
await saleManager.setMaxPerWallet(5); // 设置为 5 个
```

## 注意事项

1. **Owner权限**：只有 SaleManager 的 owner 才能修改销售设置
2. **Gas费用**：每次修改状态都需要支付 Gas 费用
3. **网络确认**：修改后需要等待交易确认，前端可能需要刷新才能看到新状态
4. **白名单限制**：白名单阶段每个地址最多购买 3 个
5. **公售限制**：公售阶段每个钱包最多购买 `maxPerWallet` 个（默认 10 个）

