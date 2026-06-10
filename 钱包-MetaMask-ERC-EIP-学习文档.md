
# 钱包（MetaMask）与 ERC/EIP 标准学习文档

## 目录

- [一、概述：从 EOA 到智能账户](#一概述从-eoa-到智能账户)
- [二、ERC-4337：账户抽象（Account Abstraction）](#二erc-4337账户抽象account-abstraction)
- [三、EIP-7702：EOA 委托执行](#三eip-7702eoa-委托执行)
- [四、ERC-4337 与 EIP-7702 的协作全景](#四erc-4337-与-eip-7702-的协作全景)

---

## 一、概述：从 EOA 到智能账户

### 1.1 传统以太坊账户的两难

以太坊原本只有两种账户类型：

| 类型 | 特点 | 痛点 |
|------|------|------|
| **EOA**（外部账户） | 由私钥控制，免费创建 | 私钥丢失=资产丢失；每次操作需 ETH 付 Gas；无法批量交易；无权限控制 |
| **合约账户** | 由代码控制，功能灵活 | 无法主动发起交易；需要 EOA 触发 |

```
MetaMask 用户每天遇到的问题：
  ❌ 想用 USDC 付 Gas → 不行，必须用 ETH
  ❌ 私钥泄露 → 资产全部被盗，无法挽回
  ❌ 想批量操作（approve + swap）→ 必须两次确认
  ❌ 想设置每日消费限额 → EOA 不支持
  ❌ 新人没有 ETH → 无法进行任何链上操作
```

### 1.2 ERC-4337 和 EIP-7702 的解决方案

```
┌──────────────────────────────────────────────────────────────┐
│                    以太坊账户演进路线                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  传统 EOA                    ERC-4337 智能账户                │
│  ┌────────┐                 ┌──────────────┐                │
│  │ 私钥   │                 │  智能合约钱包  │                │
│  │ 签名   │                 │  (ERC-4337)  │                │
│  │ 单一   │    ─────────>   │  多签/社交恢复│                │
│  └────────┘                 │  Paymaster   │                │
│       │                     │  批量交易    │                │
│       │                     └──────┬───────┘                │
│       │                            │                        │
│       │              EIP-7702      │                        │
│       │         ┌──────────────────┘                        │
│       │         ▼                                           │
│       │    ┌──────────────────────┐                         │
│       └───>│  EOA + 委托代码      │                         │
│            │  (临时智能账户)       │                         │
│            │  单笔交易内生效       │                         │
│            └──────────────────────┘                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| 方案 | 核心思路 | 适用场景 |
|------|---------|---------|
| **ERC-4337** | 新建智能合约作为钱包，复用 EOA 签名 | 新用户、需要高级功能的钱包 |
| **EIP-7702** | 让现有 EOA 在单笔交易内"变身"为智能合约 | 存量用户、渐进式升级 |

---

## 二、ERC-4337：账户抽象（Account Abstraction）

### 2.1 核心概念

**ERC-4337** 引入了"账户抽象"——将交易签名验证从协议层移到合约层，让**智能合约也能作为钱包主动发起操作**。

```
传统交易流程（EOA）：
  用户 → 签名交易 → 节点验证签名 → 执行 → 扣 Gas

ERC-4337 交易流程（UserOperation）：
  用户 → 创建 UserOperation → 签名 → Bundler 打包 → EntryPoint 验证+执行 → 扣 Gas
```

**核心创新**：不再是用户直接发交易给节点，而是通过一个独立的**Alt Mempool**（替代内存池）和 **Bundler**（打包者）来中继。

### 2.2 核心角色

```
┌─────────────────────────────────────────────────────────────────┐
│                     ERC-4337 架构全景                              │
└─────────────────────────────────────────────────────────────────┘

  用户账户                     Bundler                  EntryPoint
  (智能合约)                   (中继节点)               (全局单例合约)
      │                          │                         │
      │  ① 创建 UserOperation     │                         │
      │     签名后发送到 Alt Mempool                        │
      │─────────────────────────>│                         │
      │                          │                         │
      │             ② Bundler 从 Mempool 收集多个 UserOp    │
      │                打包成一笔交易                       │
      │                          │                         │
      │             ③ 提交打包交易到 EntryPoint             │
      │                          │────────────────────────>│
      │                          │                         │
      │                          │  ④ EntryPoint 逐个验证   │
      │                          │    调用 account.validateUserOp()
      │                          │    → 验证签名/权限      │
      │                          │                         │
      │                          │  ⑤ 执行 UserOp          │
      │                          │    调用 account 执行操作 │
      │                          │                         │
      │                          │  ⑥ 处理 Gas 支付         │
      │                          │    account 或 Paymaster │
      │                          │    支付 ETH 给 Bundler  │
      │                          │                         │
      ▼                          ▼                         ▼
```

### 2.3 核心数据结构：UserOperation

```solidity
// ERC-4337 的核心——UserOperation 结构体
struct UserOperation {
    address sender;              // 智能钱包地址
    uint256 nonce;               // 防重放（由钱包合约管理）
    bytes initCode;              // 工厂+初始化数据（首次创建钱包时用）
    bytes callData;              // 钱包要执行的调用数据
    // Gas 相关参数
    uint256 callGasLimit;        // 执行 callData 的 gas 上限
    uint256 verificationGasLimit; // 验证签名的 gas 上限
    uint256 preVerificationGas;  // 验证前的固定 gas 消耗（补偿 Bundler）
    uint256 maxFeePerGas;        // 类似 EIP-1559 的 maxFeePerGas
    uint256 maxPriorityFeePerGas;// 类似 EIP-1559 的 maxPriorityFeePerGas
    // Paymaster 相关
    address paymasterAndData;    // Paymaster 地址 + 自定义数据
    // 签名
    bytes signature;             // 钱包的签名
}
```

### 2.4 EntryPoint 合约核心逻辑

```solidity
contract EntryPoint {
    // Bundler 调用此函数批量处理 UserOperation
    function handleOps(
        UserOperation[] calldata ops,
        address payable beneficiary  // Bundler 的收款地址
    ) external {
        for (uint256 i = 0; i < ops.length; i++) {
            UserOperation calldata op = ops[i];

            // 步骤1：如果钱包尚未部署，先部署
            if (op.initCode.length > 0) {
                _deployWallet(op);
            }

            // 步骤2：验证 UserOperation
            uint256 preGas = gasleft();
            _validatePrepayment(op);  // 调用 wallet.validateUserOp()
            uint256 gasUsed = preGas - gasleft();

            // 步骤3：执行操作
            _executeUserOp(op);

            // 步骤4：向 Bundler 补偿 Gas
            _compensateBundler(beneficiary, gasUsed);
        }
    }
}
```

### 2.5 钱包合约核心接口

```solidity
// ERC-4337 兼容的智能钱包必须实现的接口
interface IAccount {
    /**
     * @dev 验证 UserOperation 是否有效
     * @param userOp  完整的 UserOperation
     * @param userOpHash hash(userOp) 不含签名
     * @param missingAccountFunds 如果钱包余额不足，需要支付给 EntryPoint 的金额
     * @return validationData 验证结果：
     *         0 = 成功
     *         1 = 签名失败
     *         其他值 = 合并了时间范围（前48位=validUntil, 后48位=validAfter）的 SIG_VALIDATION_FAILED
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

// 智能钱包工厂接口
interface IAccountFactory {
    function createAccount(address owner, uint256 salt) external returns (address);
    function getAddress(address owner, uint256 salt) external view returns (address);
}
```

### 2.6 Paymaster：代付 Gas 的魔法

Paymaster 是 ERC-4337 最亮眼的功能：**允许第三方代为支付 Gas，或让用户用 ERC-20 代币支付 Gas**。

```solidity
// Paymaster 合约接口
interface IPaymaster {
    /**
     * @dev 验证 Paymaster 是否愿意为这个 UserOperation 支付 Gas
     * @return context 上下文数据，传给 postOp
     * @return validationData 验证结果
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost      // 预估的最大 Gas 成本
    ) external returns (bytes memory context, uint256 validationData);

    /**
     * @dev UserOperation 执行后的回调（扣款逻辑写在这里）
     */
    function postOp(
        PostOpMode mode,     // 执行状态：正常 / 已回滚
        bytes calldata context,
        uint256 actualGasCost // 实际 Gas 消耗
    ) external;
}
```

**三种 Paymaster 场景：**

```
场景1：应用赞助 Gas（免 Gas 体验）
  DApp 作为 Paymaster，帮新用户付 Gas
  → 新用户零门槛使用，DApp 获取用户

场景2：ERC-20 代付 Gas
  用户用 USDC 支付 Gas，Paymaster 在后端将 USDC 换成 ETH
  → 用户不需要持有 ETH

场景3：企业批量操作
  公司 Paymaster 统一支付员工所有链上操作的 Gas
  → 企业控制预算，员工无感知
```

```solidity
// 示例：ERC-20 代付 Gas 的 Paymaster
contract ERC20Paymaster is IPaymaster {
    IERC20 public token;
    address public oracle;  // 价格预言机

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external returns (bytes memory context, uint256) {
        // 验证用户 USDC 余额是否足够支付 Gas
        uint256 tokenAmount = _ethToToken(maxCost);
        require(token.balanceOf(userOp.sender) >= tokenAmount, "insufficient USDC");

        // 代扣 USDC（可在 postOp 执行）
        context = abi.encode(userOp.sender, tokenAmount);
        return (context, 0);
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external {
        (address user, uint256 tokenAmount) = abi.decode(context, (address, uint256));
        // 用户支付实际 Gas 的等值 USDC
        token.transferFrom(user, address(this), tokenAmount);
        // Paymaster 用自己的 ETH 支付给 EntryPoint
    }
}
```

### 2.7 社交恢复

ERC-4337 钱包可以内置社交恢复机制，彻底解决"丢私钥=丢资产"的问题：

```solidity
contract SocialRecoveryWallet is IAccount {
    address[] public guardians;          // 守护者列表
    uint256 public threshold;            // 恢复所需签名数
    address public pendingNewOwner;      // 待确认的新所有者
    uint256 public recoveryDeadline;     // 恢复提案过期时间

    function proposeRecovery(address newOwner) external {
        // 守护者发起恢复提案
        require(_isGuardian(msg.sender));
        pendingNewOwner = newOwner;
        recoveryDeadline = block.timestamp + 7 days;
        _guardianSignatures = 1;
    }

    function approveRecovery() external {
        // 其他守护者批准
        require(_isGuardian(msg.sender));
        _guardianSignatures++;
        if (_guardianSignatures >= threshold) {
            _changeOwner(pendingNewOwner);  // 更换所有者
        }
    }
}

// 典型配置：
//   guardians = [手机, 硬件钱包, 好友, 机构]
//   threshold = 2  （任意2个守护者同意即可恢复）
//
// 场景：手机丢了
//   → 用硬件钱包 + 好友 → 恢复钱包控制权
```

### 2.8 ERC-4337 对用户体验的改善

| 痛点 | 传统 EOA | ERC-4337 智能钱包 |
|------|---------|-----------------|
| Gas 支付 | 只能用 ETH | 可用任何 ERC-20 代币（Paymaster） |
| 私钥丢失 | 资产永久丢失 | 社交恢复 / 多签恢复 |
| 批量交易 | 不支持 | 一笔 UserOperation 批量执行 |
| 新人上链 | 需要先获取 ETH | 应用赞助 Gas（免 Gas） |
| 消费限额 | 不支持 | 合约自定义限额逻辑 |
| 多设备 | 私钥多设备同步风险大 | 多签 / Passkey 管理 |

---

## 三、EIP-7702：EOA 委托执行

### 3.1 核心概念

**EIP-7702** 允许 EOA 在**单笔交易内**临时获得智能合约代码。它通过引入一个新的交易类型，让用户在交易中携带一个"委托地址"参数。

```
传统 EOA 交易：
  from: 0xAlice  →  to: 0xContract  →  执行
  Alice 永远是 EOA，TransactionType = 0 或 2

EIP-7702 交易：
  from: 0xAlice  →  to: 0xContract  →  执行
  附带: authorization_list = [(chainId, 0xDelegateContract, nonce, signature)]
  Alice 在本笔交易中被当作"0xDelegateContract 的代码"来执行
```

**核心差异**：
- `0xAlice` 本身是一个 EOA（有私钥）
- 但这笔交易执行时，`0xAlice` 的行为就像是 `0xDelegateContract` 的代码一样
- 交易结束后，`0xAlice` 恢复为普通 EOA

### 3.2 授权机制

```solidity
// EIP-7702 的授权数据结构
struct Authorization {
    uint256 chainId;     // 授权的链 ID（防跨链重放）
    address address;     // 委托合约地址
    uint256 nonce;       // EOA 的当前 nonce
    uint8 yParity;       // 签名恢复所需
    bytes32 r;           // 签名 r
    bytes32 s;           // 签名 s
}

// EOA 使用其私钥对授权消息签名：
// authHash = keccak256(MAGIC ‖ chainId ‖ address ‖ nonce)
// 签名的 authHash 被包含在交易中
```

### 3.3 委托合约

委托合约需要实现一个特殊的函数选择器作为入口：

```solidity
// EIP-7702 委托合约示例
contract DelegateContract {
    // 当 EOA 通过 EIP-7702 使用本合约时，这个函数被调用
    // selector = bytes4(keccak256("executeFromEOA(bytes)"))
    function executeFromEOA(bytes calldata callData) external {
        // 解析 callData 中的具体操作（如 approve + swap）
        (address[] memory targets, uint256[] memory values, bytes[] memory data) =
            abi.decode(callData, (address[], uint256[], bytes[]));

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(data[i]);
            require(success, "call failed");
        }
    }
}
```

### 3.4 EIP-7702 与 EIP-2612 Permit 的类比

两者都是"将两个步骤合并为一个"的模式，但层次不同：

| 维度 | EIP-2612 Permit | EIP-7702 Delegation |
|------|----------------|---------------------|
| **解决的问题** | `approve + action` 两笔交易 | EOA 不能批量操作 |
| **合并方式** | 离线签名替代链上 approve | 临时授权 EOA 获得智能合约能力 |
| **签名内容** | Permit(owner, spender, value, ...) | Authorization(chainId, delegateContract, nonce) |
| **生效范围** | ERC-20 代币的授权额度 | EOA 的整体行为能力 |
| **效果** | 一笔交易完成授权+兑换 | EOA 变成"智能钱包"完成批量操作 |

### 3.5 实际应用：一键 approve + swap

```javascript
// 传统方式（MetaMask 现状）：
//   交易1：approve(USDC, Router, 1000)
//   交易2：swapExactTokensForETH(1000, ...)
//   用户需要两次确认 + 等待两笔交易确认

// EIP-7702 方式（未来）：
//   一笔交易，包含委托代码：
const authorization = {
    chainId: 1,
    address: delegateContract,    // 委托合约地址
    nonce: await wallet.getNonce()
};

// 用户签名授权
const authHash = ethers.keccak256(
    ethers.solidityPacked(
        ["bytes1", "bytes1", "uint256", "address", "uint256"],
        ["0x05", "0x00", chainId, delegateContract, nonce]
    )
);
const signature = await wallet.signMessage(ethers.getBytes(authHash));

// 构造 EIP-7702 交易
const tx = {
    type: 4,                      // EIP-7702 交易类型
    to: USDC_ADDRESS,
    data: encodeBatch([
        USDC.approve(Router, 1000),
        Router.swapExactTokensForETH(1000, ...)
    ]),
    authorizationList: [{ authorization, signature }]
};

// 一笔交易完成 approve + swap！
```

### 3.6 EIP-7702 的两种工作模式

```
模式1：临时委托（最常见）
  交易执行期间：EOA 获得委托代码的行为
  交易结束后：EOA 恢复为普通 EOA
  → 适用于大多数场景，不需要钱包基础设施变更

模式2：持久委托
  交易执行后：EOA 地址永久获得代码（直到主动清除）
  → 适用于需要多次使用委托逻辑的场景
  → 实现方式：在交易末尾写入合约代码存储
```

### 3.7 与 ERC-4337 的定位差异

| 维度 | ERC-4337 | EIP-7702 |
|------|---------|---------|
| **适用范围** | 新建智能钱包 | 现有 EOA 用户 |
| **用户迁移成本** | 高（需要新建合约，迁移资产） | 低（保持原地址，无需迁移） |
| **Gas 优化** | 较好（链上合约统一管理） | 一般（每笔交易附带额外数据） |
| **功能丰富度** | 高（任意合约逻辑） | 取决于委托合约 |
| **私钥安全** | 可多签、社交恢复 | 仍是单一私钥 |
| **生态兼容** | 需要 DApp 适配 | 保持 EOA 地址，兼容性好 |
| **MetaMask 集成** | 需要新建"智能账户"类型 | EOA 用户无感升级 |

```
选择指南：
  想要强安全（多签/社交恢复）→ ERC-4337
  不想换地址，不想迁移资产    → EIP-7702
  两者可以组合使用             → EIP-7702 委托到 ERC-4337 钱包
```

---

## 四、ERC-4337 与 EIP-7702 的协作全景

### 4.1 互补关系

```
┌─────────────────────────────────────────────────────────────────┐
│                ERC-4337 + EIP-7702 互补架构                        │
└─────────────────────────────────────────────────────────────────┘

                    用户入口
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
     新建智能钱包                   保留 EOA 地址
    (ERC-4337)                   (EIP-7702)
          │                         │
          │  ┌──────────────────────┘
          │  │
          ▼  ▼
    ┌─────────────────────────────────────┐
    │         统一的用户体验                 │
    │                                     │
    │  • 批量交易（approve + swap）          │
    │  • 代付 Gas（Paymaster / 赞助）        │
    │  • 用任何代币支付 Gas                  │
    │  • 社交恢复（仅 ERC-4337）             │
    │                                     │
    └─────────────────────────────────────┘
```

### 4.2 组合使用：EIP-7702 委托到 ERC-4337 钱包

最优雅的方案：用 EIP-7702 将 EOA "升级"为 ERC-4337 智能钱包，既保留了原地址，又获得了完整功能。

```solidity
// 组合方案：EIP-7702 委托合约就是 ERC-4337 钱包
contract EIP7702Account is IAccount {
    // EIP-7702 入口
    function executeFromEOA(bytes calldata data) external {
        // 将批量调用转换为 UserOperation 执行
        _executeBatch(abi.decode(data, (BatchCall[])));
    }

    // ERC-4337 入口
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256) {
        // 同一套验证逻辑
        _validateSignature(userOpHash, userOp.signature);
        _payPrefund(missingAccountFunds);
        return 0;
    }
}

// 用户操作流程：
// 1. EOA 私钥签名 Authorization（指向上面的合约）
// 2. 提交 EIP-7702 交易（type=4）
// 3. 交易中调用 executeFromEOA(批量操作)
// 4. 一笔交易完成所有操作 + EOA 获得智能钱包能力
```

### 4.3 各标准分工总结

| 标准 | 在钱包生态中的角色 | 核心贡献 |
|------|-------------------|---------|
| **ERC-4337** | 智能钱包标准 | 新建智能合约钱包，支持 Paymaster、社交恢复、批量交易 |
| **EIP-7702** | EOA 委托执行 | 让现有 EOA 在交易中获得智能合约能力，零迁移成本 |

### 4.4 四篇文档的标准全景总览

| 标准 | DEX (Uniswap) | 借贷 (Aave) | NFT (OpenSea) | 钱包 (MetaMask) |
|------|:---:|:---:|:---:|:---:|
| **ERC-20** | ✅ 代币兑换 | ✅ aToken/debtToken | - | - |
| **ERC-721** | ✅ LP NFT | - | ✅ 核心标准 | - |
| **ERC-1155** | - | - | ✅ 多代币合集 | - |
| **ERC-165** | - | - | ✅ 接口检测 | - |
| **ERC-2981** | - | - | ✅ 创作者版税 | - |
| **ERC-1271** | - | - | ✅ 合约签名 | - |
| **ERC-2612** | ✅ Permit | ✅ supplyWithPermit | - | - |
| **ERC-4626** | - | ✅ Vault 标准 | - | - |
| **ERC-4337** | - | - | - | ✅ **智能钱包** |
| **EIP-7702** | - | - | - | ✅ **EOA 委托** |
| **EIP-712** | ✅ Permit 签名 | ✅ Permit+信用委托 | ✅ 链下挂单 | - |

---

> **学习建议**：这篇的内容与前三篇有本质不同——前三篇讲的是"链上应用如何标准化交互"，这篇讲的是"钱包本身如何升级"。建议先理解传统 EOA 的局限性（私钥单点故障、只能用 ETH 付 Gas、无法批量交易），再对比 ERC-4337（全新智能钱包）和 EIP-7702（渐进式升级 EOA）两种解决思路的差异与互补。Paymaster 代付 Gas 是理解 ERC-4337 价值的最佳切入点。
