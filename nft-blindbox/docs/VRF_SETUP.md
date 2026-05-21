# VRF 配置指南

## 问题诊断

如果购买 NFT 盲盒时出现 `missing revert data` 或 `execution reverted` 错误，很可能是 VRF 订阅配置问题。

## 快速检查

运行检查脚本：

```bash
npx hardhat run scripts/checkVRFSubscription.ts --network sepolia
```

## 解决方案

### 步骤 1：创建 VRF 订阅

1. 访问 [Chainlink VRF 控制台](https://vrf.chain.link/sepolia)
2. 连接钱包（需要是订阅的 owner）
3. 点击 "Create Subscription"
4. 记录返回的 Subscription ID

### 步骤 2：充值 LINK 代币

1. 在 VRF 控制台找到你的订阅
2. 点击 "Fund Subscription"
3. 充值至少 2 LINK（建议 5-10 LINK）

### 步骤 3：添加消费者

有两种方式：

#### 方式一：使用脚本（推荐）

```bash
# 设置环境变量
export SUBSCRIPTION_ID=你的订阅ID
export VRF_HANDLER_ADDRESS=0x4D20b164679EBb5775718fE829e3Af185fd6Df81

# 执行脚本（需要是订阅的 owner）
npx hardhat run scripts/addVRFConsumer.ts --network sepolia
```

#### 方式二：在 VRF 控制台手动添加

1. 在 VRF 控制台找到你的订阅
2. 点击 "Add consumer"
3. 输入 VRFHandler 地址：`0x4D20b164679EBb5775718fE829e3Af185fd6Df81`
4. 确认添加

### 步骤 4：更新 VRFHandler 配置（重要！）

**必须执行此步骤**，将新的 Subscription ID 和 keyHash 更新到 VRFHandler 合约中：

#### 如果使用 500 Gwei keyHash（费用过高），切换到 200 Gwei keyHash：

**200 Gwei 是 VRF v2.5 在 Sepolia 上最低费用的选项。**

```bash
# 设置环境变量
export VRF_HANDLER_ADDRESS=你的VRFHandler地址
export SEPOLIA_VRF_COORDINATOR=0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
export SEPOLIA_KEY_HASH=0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae  # 200 Gwei keyHash（最低费用）
export SEPOLIA_SUBSCRIPTION_ID=你的订阅ID
export SEPOLIA_CALLBACK_GAS_LIMIT=80000  # 可以降低到 50000-80000 以节省费用
export SEPOLIA_REQUEST_CONFIRMATIONS=3

# 执行更新脚本
npx hardhat run scripts/updateVRFConfig.ts --network sepolia
```

**重要提示：**
- **200 Gwei keyHash** 的费用约为 **500 Gwei keyHash 的 2/5**（约 0.02 LINK vs 0.05 LINK）
- 如果当前显示 500 Gwei，说明使用了高 gas price ceiling 的 keyHash
- 切换到 200 Gwei keyHash 可以降低费用（这是 v2.5 在 Sepolia 上**最低费用的选项**）
- **VRF v2.5 在 Sepolia 上不支持 30 Gwei**，最低就是 200 Gwei

脚本会自动：
- 检查你是否是 VRFHandler 的 owner
- 显示当前配置和新配置
- 更新 keyHash、Subscription ID 和其他 VRF 参数
- 验证更新结果

### 步骤 5：验证配置

```bash
npx hardhat run scripts/checkVRFSubscription.ts --network sepolia
```

应该看到：
- ✅ VRFHandler 在消费者列表中
- ✅ 订阅有足够的 LINK 余额

## Sepolia 测试网配置

- **VRF Coordinator**: `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B`
- **Key Hash**: 根据 gas 价格需求选择（见下方说明）
- **LINK 代币地址**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`

### Key Hash 选择（Gas Price Ceiling）

根据 [Chainlink VRF v2.5 官方文档](https://docs.chain.link/vrf/v2-5/overview/subscription)，在 Sepolia 测试网上：

| Gas Price Ceiling | Key Hash | 适用场景 | 状态 |
|-------------------|----------|---------|------|
| **200 Gwei** | `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` | **最低费用选项（推荐）** | ✅ 可用 |
| **500 Gwei** | 在 VRF 控制台查看 | 高费用，适合高优先级或网络拥堵时 | ✅ 可用 |

**推荐使用 200 Gwei 的 keyHash**，这是 VRF v2.5 在 Sepolia 上**最低费用的选项**。

**重要说明：**
- `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` 对应的是 **200 Gwei**，不是 30 Gwei
- VRF v2.5 在 Sepolia 上**不支持 30 Gwei** 的 gas lane
- 200 Gwei 是 Sepolia 上最低的 gas price ceiling

**如何获取正确的 keyHash：**
1. 访问 [VRF 控制台](https://vrf.chain.link/sepolia)
2. 点击 "Create Subscription" 或查看现有订阅
3. 在创建/编辑订阅时，会显示所有可用的 keyHash 及其对应的 gas price ceiling
4. 选择 **200 Gwei** 的 keyHash（最低费用选项）
5. 复制该 keyHash 并更新到 VRFHandler 配置中

**查询脚本：**
你也可以运行脚本查询 VRF Coordinator 支持的所有 keyHash：
```bash
npx hardhat run scripts/queryVRFKeyHashes.ts --network sepolia
```

**如何查看可用的 keyHash：**
1. 访问 [VRF 控制台](https://vrf.chain.link/sepolia)
2. 在创建订阅或查看订阅详情时，可以看到所有可用的 keyHash 及其对应的 gas price ceiling
3. 选择 30 Gwei 的 keyHash 可以大幅降低费用

**费用计算示例：**
- 30 Gwei keyHash + 100,000 gas limit ≈ 0.003 LINK
- 500 Gwei keyHash + 100,000 gas limit ≈ 0.05 LINK（约 16 倍）

**降低费用的方法：**
1. **使用 30 Gwei 的 keyHash**（最重要）
2. **降低 callbackGasLimit**：从 100,000 降低到 50,000-80,000（如果回调函数逻辑简单）
3. **充值足够的 LINK**：确保订阅余额充足

## 主网配置

- **VRF Coordinator**: `0x271682DEB8C4E0901D1a1550aD2e70DcC1bFfE06`
- **Key Hash**: 根据 gas 价格选择（在 VRF 控制台查看）
- **LINK 代币地址**: `0x514910771AF9Ca656af840dff83E8264EcF986CA`

## 常见问题

### Q: 为什么需要 LINK 代币？

A: Chainlink VRF 服务需要 LINK 代币支付费用。每次请求随机数会消耗一定数量的 LINK。

### Q: 需要多少 LINK？

A: 
- **使用 30 Gwei keyHash**：建议 2-5 LINK，每次请求约 0.003-0.01 LINK
- **使用 500 Gwei keyHash**：建议 10-20 LINK，每次请求约 0.05-0.1 LINK

**强烈建议使用 30 Gwei 的 keyHash 以降低费用！**

### Q: 为什么显示 500 Gwei 的 gas price？

A: 500 Gwei 是 Chainlink VRF 的 **gas price ceiling**（gas 价格上限），由你选择的 keyHash 决定。这不是实际支付的 gas 价格，而是最大允许值。

**问题：**
- 如果使用 500 Gwei 的 keyHash，即使实际网络 gas 价格只有 1 Gwei，Chainlink 也会按 500 Gwei 的上限计算费用
- 这会导致费用过高（如你看到的 30+ LINK）

**解决方案：**
1. 切换到 30 Gwei 的 keyHash（推荐）
2. 更新 VRFHandler 合约的 keyHash 配置
3. 充值足够的 LINK 到订阅

### Q: 如何切换到更低的 gas price ceiling？

A: 
1. 在 VRF 控制台查看可用的 keyHash 列表
2. 选择 30 Gwei 的 keyHash：`0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae`
3. 更新 VRFHandler 配置（见下方脚本）

### Q: 控制台显示 "Max gas price: 500 Gwei"，这是否可以改变？

A: **不需要改变，这是正常的！**

**重要说明：**
- 控制台显示的 "Max gas price: 500 Gwei" 是**页面的通用信息**，表示该网络支持的最大 gas price ceiling
- 这不是你的订阅配置，也不是你选择的 keyHash 的配置
- **实际费用取决于你选择的 keyHash**，而不是控制台显示的通用最大值

**验证方法：**
1. 确认你的 VRFHandler 使用的是 30 Gwei 的 keyHash：`0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae`
2. 进行新的购买测试
3. 在 VRF 控制台的 "Pending" 或 "History" 中查看新请求的 "Max Cost"
4. 如果使用 30 Gwei keyHash，新请求的费用应该约为 **0.003-0.01 LINK**（而不是 30 LINK）

**总结：**
- 控制台显示的 "Max gas price: 500 Gwei" 是信息展示，无法也不需要改变
- 你的合约使用的是 30 Gwei 的 keyHash，实际费用会很低
- 查看新请求的实际费用来验证配置是否正确

### Q: 如何获取测试网 LINK？

A: 访问 [Chainlink Faucet](https://faucets.chain.link/sepolia) 获取测试网 LINK。

### Q: 订阅 ID 在哪里查看？

A: 在 [VRF 控制台](https://vrf.chain.link/sepolia) 的订阅列表中查看。

## 测试购买

配置完成后，可以测试购买：

```bash
npx hardhat run scripts/testPurchase.ts --network sepolia
```

如果一切正常，应该能够成功购买 NFT 盲盒。

