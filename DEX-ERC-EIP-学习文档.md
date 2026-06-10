
# DEX（Uniswap）与 ERC/EIP 标准学习文档

## 目录

- [一、概述](#一概述)
- [二、ERC-20：同质化代币标准](#二erc-20同质化代币标准)
- [三、ERC-2612：Permit 离线签名授权](#三erc-2612permit-离线签名授权)
- [四、EIP-712：结构化数据签名标准](#四eip-712结构化数据签名标准)
- [五、ERC-721：非同质化代币标准](#五erc-721非同质化代币标准)
- [六、这些标准在 DEX/Uniswap 中的实际应用](#六这些标准在-dexuniswap-中的实际应用)

---

## 一、概述

### ERC 和 EIP 的关系

| 术语 | 全称 | 含义 |
|------|------|------|
| **EIP** | Ethereum Improvement Proposal | 以太坊改进提案，是对以太坊网络的改进建议 |
| **ERC** | Ethereum Request for Comments | 以太坊征求意见稿，是 EIP 的一个子类，专注于应用层标准 |

> 简单理解：ERC 是"标准化的合约接口规范"，EIP 范围更广（包括核心协议、网络、接口等）。

### 为什么需要这些标准？

在去中心化交易所（DEX，如 Uniswap）中，这些标准共同构成了一套完整的代币交互体系：

```
用户授权 DEX 花费代币
    │
    ├── 传统方式：approve + transferFrom（需要两笔交易，消耗 Gas）
    │
    └── Permit 方式：离线签名 → 链上验证（一笔交易，节省 Gas）
            │
            ├── ERC-20：定义代币基本接口（transfer, approve, transferFrom）
            ├── ERC-2612：扩展 ERC-20，支持离线签名授权（permit 函数）
            └── EIP-712：定义结构化数据签名规范（保证签名安全可读）
```

---

## 二、ERC-20：同质化代币标准

### 2.1 核心概念

**ERC-20** 是以太坊上最基础、使用最广泛的代币标准。它定义了一套统一的接口，使所有 ERC-20 代币可以用相同的方式交互。

**"同质化"** 意味着：每个代币单位完全相同，可以互换（就像 1 美元永远等于另 1 美元）。

### 2.2 核心接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    // 查询代币总供应量
    function totalSupply() external view returns (uint256);

    // 查询某个地址的代币余额
    function balanceOf(address account) external view returns (uint256);

    // 转账（调用者将自己余额转给 to）
    function transfer(address to, uint256 amount) external returns (bool);

    // 查询授权额度（owner 授权给 spender 的金额）
    function allowance(address owner, address spender) external view returns (uint256);

    // 授权（owner 授权 spender 可以花费自己最多 amount 个代币）
    function approve(address spender, uint256 amount) external returns (bool);

    // 代理转账（spender 从 from 账户转走 amount 个代币给 to）
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // === 事件 ===
    // 转账时触发
    event Transfer(address indexed from, address indexed to, uint256 value);
    // 授权时触发
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

### 2.3 DEX 中的典型交互流程

在 Uniswap 中用 USDC 兑换 ETH 的流程：

```
步骤1：用户调用 USDC.approve(UniswapRouter, 1000 USDC)
       → 授权 Uniswap 的路由合约可以动用用户的 USDC

步骤2：用户调用 UniswapRouter.swapExactTokensForETH(1000 USDC, ...)
       → 路由合约内部调用 USDC.transferFrom(user, pair, 1000 USDC)
       → 路由合约将 ETH 转给用户
```

**问题**：需要两笔交易（approve + swap），用户支付两次 Gas。

**解决**：ERC-2612 Permit 机制。

---

## 三、ERC-2612：Permit 离线签名授权

### 3.1 核心概念

**ERC-2612** 是对 ERC-20 的扩展，引入 `permit` 函数，允许用户通过**离线签名**来完成授权，无需发起链上 `approve` 交易。

### 3.2 核心接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC2612 is IERC20 {
    // 通过签名完成授权（无需用户发送 approve 交易）
    function permit(
        address owner,      // 代币持有者
        address spender,    // 被授权者（如 Uniswap Router）
        uint256 value,      // 授权金额
        uint256 deadline,   // 签名过期时间
        uint8 v,            // 签名 v 值
        bytes32 r,          // 签名 r 值
        bytes32 s           // 签名 s 值
    ) external;

    // 查询 nonce（防重放攻击）
    function nonces(address owner) external view returns (uint256);

    // EIP-712 域名分隔符
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
```

### 3.3 Permit 工作流程

```
┌──────────┐                          ┌──────────────┐
│  用户 A   │                          │   链上合约    │
└────┬─────┘                          └──────┬───────┘
     │                                       │
     │ 1. 用户 A 离线构造签名消息：              │
     │    { owner: A,                        │
     │      spender: UniswapRouter,          │
     │      value: 1000,                     │
     │      deadline: 当前时间 + 30分钟,       │
     │      nonce: 链上查询的最新 nonce }      │
     │                                       │
     │ 2. 用私钥对消息签名 → 得到 v, r, s       │
     │                                       │
     │ 3. 将 v, r, s 发送给 Relayer              │
     │                                       │
     │     ┌─────────────────────────────┐   │
     │     │  Relayer（可以是用户自己、    │   │
     │     │  DEX 后端、或第三方中继器）   │   │
     │     └──────────┬──────────────────┘   │
     │                │                      │
     │                │ 4. 发送一笔交易：       │
     │                │    - 调用 permit() 完成授权
     │                │    - 调用 swap() 完成兑换
     │                │                      │
     │                │   permit(owner, spender, │
     │                │          value, deadline,│
     │                │          v, r, s)        │
     │                ├─────────────────────>│
     │                │                      │ 5. 验证签名
     │                │                      │    更新 allowance
     │                │                      │    增加 nonce
     │                │                      │
     │                │   swap(...)           │
     │                ├─────────────────────>│
     │                │                      │
     │                │   交易确认 ←─────────│
     │                │<─────────────────────│
     │                                       │
     ▼                                       ▼
```

### 3.4 Permit 安全机制

| 机制 | 说明 |
|------|------|
| **nonce** | 每次 permit 后 nonce+1，签名内容包含当前 nonce，防止重放攻击 |
| **deadline** | 签名有有效期，过期后签名失效，防止无限期有效 |
| **DOMAIN_SEPARATOR** | 域名分隔符，确保签名只在特定链/特定合约上有效 |
| **chainId** | 签名包含链 ID，防止跨链重放 |

### 3.5 前端 Permi 签名示例（ethers.js）

```javascript
import { ethers } from "ethers";

async function signPermit(tokenContract, owner, spender, value, deadline) {
    // 1. 获取当前 nonce
    const nonce = await tokenContract.nonces(owner.address);

    // 2. 获取 DOMAIN_SEPARATOR
    const domain = {
        name: await tokenContract.name(),
        version: "1",
        chainId: (await provider.getNetwork()).chainId,
        verifyingContract: await tokenContract.getAddress()
    };

    // 3. 定义 Permit 类型（EIP-712 结构化数据）
    const types = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
        ]
    };

    // 4. 构造签名消息
    const message = { owner, spender, value, nonce, deadline };

    // 5. 用 EIP-712 方式签名（MetaMask 会显示人类可读的签名内容）
    const signature = await owner.signTypedData(domain, types, message);

    // 6. 解析签名
    const { v, r, s } = ethers.Signature.from(signature);

    return { v, r, s };
}
```

**对比传统 approve 的优势：**

| 维度 | 传统 approve | Permit (EIP-712) |
|------|-------------|-------------------|
| 交易次数 | 2 笔（approve + action） | 1 笔（仅 action） |
| Gas 消耗 | 约 45,000（approve）+ swap Gas | 仅 swap Gas |
| 用户体验 | 需要两次 MetaMask 确认 | 签名 + 一次确认 |
| 安全性 | 链上操作，签名内容不可见 | 结构化签名，MetaMask 显示可读内容 |

---

## 四、EIP-712：结构化数据签名标准

### 4.1 核心概念

**EIP-712** 定义了**结构化数据**的哈希和签名标准。它解决了 `eth_sign` 的"盲签"问题——用户在 MetaMask 中能看到签名的具体内容，而不是一串无意义的十六进制哈希。

### 4.2 为什么需要 EIP-712？

```
传统 eth_sign：
  用户看到：签名 0xabc123def456...（完全看不出要签什么）
  
EIP-712 signTypedData：
  用户看到：
    ┌─────────────────────────────────┐
    │  Permit                         │
    │                                 │
    │  Owner:    0x1234...abcd        │
    │  Spender:  Uniswap V2 Router    │
    │  Value:    1000 USDC            │
    │  Nonce:    3                    │
    │  Deadline: 2026-05-26 14:30     │
    └─────────────────────────────────┘
```

### 4.3 数据结构定义

```solidity
// 在合约中定义 EIP-712 数据结构

contract MyToken is ERC20, ERC2612 {
    // EIP-712 类型哈希常量
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    // EIP-712 域名分隔符
    bytes32 public DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name())),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // 检查过期时间
        require(block.timestamp <= deadline, "ERC2612: expired deadline");

        // 构造 EIP-712 结构化哈希
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonces[owner]++,
                deadline
            )
        );

        // 完整的 EIP-712 消息哈希
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        // 从签名恢复地址
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress == owner, "ERC2612: invalid signature");

        // 更新授权额度
        _approve(owner, spender, value);
    }
}
```

### 4.4 EIP-712 消息哈希构造公式

```
完整的消息哈希 = keccak256("\x19\x01" ‖ DOMAIN_SEPARATOR ‖ hashStruct(message))

其中：
  "\x19\x01"     → EIP-191 前缀，防止签名在其他场景被重用
  DOMAIN_SEPARATOR → 域名分隔符，包含合约名、版本、链ID、合约地址
  hashStruct     → 带类型的结构化哈希
```

### 4.5 DOMAIN_SEPARATOR 详解

```solidity
DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(bytes("MyToken")),    // 合约名称
        keccak256(bytes("1")),          // 版本号
        block.chainid,                  // 链 ID（1=主网, 5=Goerli 等）
        address(this)                   // 合约地址
    )
);
```

**为什么需要 DOMAIN_SEPARATOR？**

| 场景 | 无 DOMAIN_SEPARATOR | 有 DOMAIN_SEPARATOR |
|------|-------------------|-------------------|
| 同合约升级 | 旧签名仍有效（可能不安全） | 版本不同，签名自动失效 |
| 跨链重放 | 主网签名可在测试网使用 | chainId 不同，签名无效 |
| 不同合约 | A 合约签名可在 B 合约使用 | 合约地址不同，签名无效 |

---

## 五、ERC-721：非同质化代币标准

### 5.1 核心概念

**ERC-721** 是**非同质化代币（NFT）** 标准。与 ERC-20 不同，**每个 ERC-721 代币都是独一无二的**。

```
ERC-20（同质化）：每个代币完全相同
  1000 USDC = 1000 USDC  （完全相同，可互换）

ERC-721（非同质化）：每个 tokenId 是唯一的
  NFT #1 ≠ NFT #2  （每个都有不同的属性和价值）
```

### 5.2 核心接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721 {
    // === 查询函数 ===
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);

    // === 转账函数 ===
    // 安全转账（会检查接收方是否能处理 NFT）
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;

    // 普通转账（不检查接收方）
    function transferFrom(address from, address to, uint256 tokenId) external;

    // === 授权函数 ===
    // 批准某个地址操作指定的 tokenId
    function approve(address to, uint256 tokenId) external;
    // 设置或取消全局授权（授权某个地址操作所有 NFT）
    function setApprovalForAll(address operator, bool approved) external;
    // 查询单个 tokenId 的授权状态
    function getApproved(uint256 tokenId) external view returns (address);
    // 查询全局授权状态
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    // === 事件 ===
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
}

// 可选：元数据扩展接口
interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

### 5.3 ERC-721 与 ERC-20 关键区别

| 特性 | ERC-20 | ERC-721 |
|------|--------|---------|
| 代币性质 | 同质化（可互换） | 非同质化（独一无二） |
| 余额存储 | `mapping(address => uint256)` | `mapping(address => uint256)` + `mapping(uint256 => address)` |
| 转账参数 | `(to, amount)` | `(from, to, tokenId)` |
| 最小单位 | 可小数（如 0.5 USDC） | 不可分割（只能是 1 个 NFT） |
| 元数据 | 通常无 | 有 tokenURI（指向图片/属性 JSON） |
| 授权粒度 | 按金额 | 按单个 tokenId 或全局 |

### 5.4 在 Uniswap V4 中的应用：LP NFT

Uniswap V3/V4 将流动性头寸用 **ERC-721 NFT** 来表示：

```
用户在 Uniswap V3 提供流动性
    │
    ▼
获得一个 NFT（LP Token）
    │
    ├── tokenId: 12345（唯一标识这个流动性头寸）
    ├── 包含数据：价格区间、流动性数量、手续费等级
    └── 可转让、可质押、可作为抵押品
```

---

## 六、这些标准在 DEX/Uniswap 中的实际应用

### 6.1 Uniswap 交易流程中的标准协作

```
┌─────────────────────────────────────────────────────────────────┐
│              Uniswap Swap 完整流程（使用 Permit）                  │
└─────────────────────────────────────────────────────────────────┘

  用户                                                      Uniswap
   │                                                          │
   │  ① 离线构造 EIP-712 Permit 签名（ERC-2612）                │
   │     类型定义按 EIP-712 规范                               │
   │     MetaMask 显示可读内容                                 │
   │                                                          │
   │  ② 用私钥签名 → 得到 v, r, s                              │
   │                                                          │
   │  ③ 发起链上交易：                                         │
   │     Router.multicall([                                   │
   │         permit(owner, router, amount, deadline, v,r,s),   │
   │         swapExactTokensForETH(amount, minOut, ...)        │
   │     ])                                                    │
   │────────────────────────────────────────────────────>│
   │                                                          │
   │                                 ④ 先执行 permit：          │
   │                                    验证 EIP-712 签名      │
   │                                    更新 allowance          │
   │                                                          │
   │                                 ⑤ 再执行 swap：           │
   │                                    transferFrom 划转代币  │
   │                                    执行兑换逻辑           │
   │                                    ETH 转给用户           │
   │                                                          │
   │  ⑥ 收到 ETH ←────────────────────────────────────────│
   │                                                          │
   ▼                                                          ▼

  总结：一笔交易完成授权+兑换，节省约 50% 的 Gas！
```

### 6.2 各标准的分工总结

| 标准 | 在 DEX 中的角色 | 解决的问题 |
|------|----------------|-----------|
| **ERC-20** | 定义代币基本接口 | 统一所有代币的 transfer/approve 行为 |
| **ERC-2612** | 离线签名授权 | 将两笔交易合并为一笔，节省 Gas |
| **EIP-712** | 结构化签名规范 | 让用户在签名时能看到具体内容，防止盲签攻击 |
| **ERC-721** | 流动性头寸 NFT | 将 LP 头寸代币化，支持转让、借贷等 DeFi 组合 |

### 6.3 相关 EIP 补充

| EIP | 说明 | 与 DEX 的关系 |
|-----|------|---------------|
| **EIP-1559** | 动态 Gas 费机制 | DEX 交易 Gas 估算更准确 |
| **EIP-4337** | 账户抽象 | 支持代付 Gas，改善 DEX 用户体验 |
| **EIP-4626** | 收益聚合器标准 | 生息代币在 DEX 中的统一接口 |
| **EIP-6909** | 极简多代币标准 | Uniswap V4 使用的 ERC-1155 替代方案 |

---

> **学习建议**：建议按 ERC-20 → EIP-712 → ERC-2612 → ERC-721 的顺序学习，因为前一个标准是后一个的基础。理解 EIP-712 的签名规范后，再去理解 ERC-2612 的 permit 实现会更加轻松。
