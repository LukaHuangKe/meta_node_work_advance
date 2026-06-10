
# 借贷（Aave）与 ERC/EIP 标准学习文档

## 目录

- [一、概述](#一概述)
- [二、ERC-20：借贷中的存款代币 aToken](#二erc-20借贷中的存款代币-atoken)
- [三、ERC-2612：借贷场景下的无 Gas 授权](#三erc-2612借贷场景下的无-gas-授权)
- [四、EIP-712：借贷中的结构化签名](#四eip-712借贷中的结构化签名)
- [五、ERC-4626：收益金库标准（重点）](#五erc-4626收益金库标准重点)
- [六、Aave 协议中的标准协作全景](#六aave-协议中的标准协作全景)

---

## 一、概述

### Aave 协议简介

Aave 是一个去中心化借贷协议，核心机制：

```
存款人                           借款人
   │                               │
   │  存入 USDC                     │  抵押 ETH
   │  获得 aUSDC（aToken）          │  借出 USDC
   ▼                               ▼
         ┌─────────────────────┐
         │    Aave 借贷池       │
         │                     │
         │  存款 → 赚取利息     │
         │  借款 → 支付利息     │
         │  清算 → 保护协议     │
         └─────────────────────┘
```

### 涉及的核心标准

| 标准 | 在 Aave 中的角色 |
|------|-----------------|
| **ERC-20** | aToken（存款凭证）、债务代币（debt token）均基于 ERC-20 |
| **ERC-2612** | 存款/还款时的一笔交易授权，节省 Gas |
| **EIP-712** | 信用委托（Credit Delegation）的签名授权 |
| **ERC-4626** | Aave V3 的 yield-bearing vault 标准化接口 |

---

## 二、ERC-20：借贷中的存款代币 aToken

### 2.1 aToken 是什么？

在 Aave 中存入资产后，用户获得 **aToken**（如存入 USDC 获得 aUSDC）。这是 Aave 的核心创新之一：

```
存入 1000 USDC → 铸造 1000 aUSDC（汇率 1:1）
取出 1000 USDC ← 销毁 1000 aUSDC

aUSDC 余额会随时间自动增长（利息累积）
  存入时：1000 aUSDC
  一年后（利率 5%）：余额 ≈ 1050 aUSDC
```

### 2.2 aToken 余额增长的实现

Aave 使用**动态汇率**而非 rebase 机制：

```solidity
// 简化版 aToken 核心逻辑
contract AToken is ERC20 {
    // 流动性指数（随时间增长）
    uint256 private _liquidityIndex = 1e27;  // RAY 精度

    // 查询用户的"缩放余额"（不会自动变化）
    mapping(address => uint256) private _scaledBalances;

    // 转账时先计算当前真实余额
    function balanceOf(address account) public view override returns (uint256) {
        // 真实余额 = 缩放余额 × 当前流动性指数
        return _scaledBalances[account].rayMul(_liquidityIndex);
    }

    // 铸造 aToken：将存款金额转换为缩放余额
    function mint(address user, uint256 amount) external onlyPool {
        // 缩放余额 = 金额 / 当前指数
        uint256 scaledAmount = amount.rayDiv(_liquidityIndex);
        _scaledBalances[user] += scaledAmount;
    }
}
```

**关键理解**：用户的 `_scaledBalances` 不变，但 `_liquidityIndex` 随时间增长，所以 `balanceOf()` 返回的值自动增加——这就是利息的体现。

### 2.3 债务代币（Debt Token）

Aave 还使用两种 ERC-20 债务代币来记录借款：

| 代币类型 | 名称示例 | 特点 |
|---------|---------|------|
| **稳定利率债务** | `stableDebtUSDC` | 利率固定，不可转让 |
| **浮动利率债务** | `variableDebtUSDC` | 利率随市场变化，不可转让 |

债务代币的 `balanceOf()` 返回用户的借款金额（含利息），增长逻辑与 aToken 类似。

---

## 三、ERC-2612：借贷场景下的无 Gas 授权

### 3.1 Aave 中的典型场景

借贷操作和 DEX 一样面临**两笔交易**的问题：

```
传统方式（两笔交易）：
  步骤1 → approve(AavePool, 1000 USDC)    // 授权 Aave 动用 USDC
  步骤2 → pool.deposit(USDC, 1000, ...)   // 执行存款

Permit 方式（一笔交易）：
  离线签名 Permit → pool.deposit(USDC, 1000, ...)  // 一步完成
```

### 3.2 Aave V3 的供应签名流程

Aave V3 提供了 `supplyWithPermit()` 函数，将 permit 和 deposit 合并：

```solidity
// Aave V3 Pool 合约
contract Pool {
    function supplyWithPermit(
        address asset,           // 存款代币地址（如 USDC）
        uint256 amount,          // 存款金额
        address onBehalf,        // 存款受益人
        uint16 referralCode,     // 推荐码
        uint256 deadline,        // Permit 签名过期时间
        uint8 v,                 // 签名 v 值
        bytes32 r,               // 签名 r 值
        bytes32 s                // 签名 s 值
    ) external {
        // 1. 验证 EIP-2612 Permit 签名，完成授权
        IERC2612(asset).permit(msg.sender, address(this), amount, deadline, v, r, s);

        // 2. 执行存款
        _supply(asset, amount, onBehalf, referralCode);
    }
}
```

### 3.3 适用场景

| 操作 | 是否适用 Permit | 说明 |
|------|:---:|------|
| 存款 `supply()` | ✅ | `supplyWithPermit()` 已原生支持 |
| 还款 `repay()` | ✅ | `repayWithPermit()` 已原生支持 |
| 借款 `borrow()` | ❌ | 借出代币无需授权，协议直接转给用户 |
| 取款 `withdraw()` | ❌ | aToken 赎回是销毁操作，无需额外授权 |

---

## 四、EIP-712：借贷中的结构化签名

### 4.1 信用委托（Credit Delegation）

Aave 最具创新性的功能之一：用户可以将自己的**信用额度**委托给他人，被委托者可以借款，委托者赚取利息。

```
Alice（有抵押品）                 Bob（需要借款）

   │   ① Alice 用 EIP-712 签名         │
   │      授权 Bob 使用她的信用额度      │
   │─────────────────────────────────>│
   │                                  │
   │   ② Bob 调用借款，Alice 的          │
   │      抵押品作为担保                 │
   │                                  borrow(...)
   │                                  │
   │   ③ 利息由 Alice 赚取             │
   │<─────────────────────────────────│
```

### 4.2 信用委托的 EIP-712 签名结构

```solidity
// Aave 信用委托的 EIP-712 类型定义
bytes32 public constant DELEGATION_TYPEHASH = keccak256(
    "Delegation(address delegatee,uint256 value,uint256 nonce,uint256 deadline)"
);

struct Delegation {
    address delegatee;   // 被委托者（Bob）
    uint256 value;       // 委托金额
    uint256 nonce;       // 防重放
    uint256 deadline;    // 过期时间
}
```

### 4.3 链上验证流程

```solidity
// 用户在链上注册 DEBT_TOKEN 的 EIP-712 域名信息
function delegationWithSig(
    address delegator,     // 委托者（Alice）
    address delegatee,     // 被委托者（Bob）
    uint256 value,         // 委托金额
    uint256 deadline,      // 过期时间
    uint8 v, bytes32 r, bytes32 s
) external {
    // 1. 验证 EIP-712 签名（签名内容包含 DEBT_TOKEN 的域名分隔符）
    bytes32 digest = _getDelegationDigest(delegator, delegatee, value, deadline);
    address recovered = ecrecover(digest, v, r, s);
    require(recovered == delegator, "invalid signature");

    // 2. 更新委托额度
    _borrowAllowances[delegator][delegatee] = value;
}
```

### 4.4 前端签名交互示例

```javascript
// 用户在 MetaMask 中签名信用委托
const domain = {
    name: "Debt Token",              // DEBT_TOKEN 域名
    version: "1",
    chainId: 1,
    verifyingContract: debtTokenAddress  // 债务代币合约地址
};

const types = {
    Delegation: [
        { name: "delegatee", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
    ]
};

const message = {
    delegatee: bobAddress,
    value: ethers.parseEther("10000"),  // 委托 10,000 信用额度
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600
};

// MetaMask 会显示：
// ┌─────────────────────────────────┐
// │  Delegation                     │
// │  Delegatee: 0xBob...Address     │
// │  Value:     10000               │
// │  Nonce:     0                   │
// │  Deadline:  2026-05-26 15:30    │
// └─────────────────────────────────┘
const signature = await signer.signTypedData(domain, types, message);
```

---

## 五、ERC-4626：收益金库标准（重点）

### 5.1 核心概念

**ERC-4626** 是**代币化收益金库**的标准接口，它统一了所有"存入资产赚取收益"的合约交互方式。

```
传统收益金库（各协议自定义接口）：
  Yearn:      deposit() / withdraw() / pricePerShare()
  Aave:       supply() / withdraw() / getReserveData()
  Compound:   mint() / redeem() / exchangeRateStored()
  → 接口不统一，集成困难

ERC-4626 标准（统一接口）：
  deposit() / mint()
  withdraw() / redeem()
  totalAssets() / convertToShares() / convertToAssets()
  previewDeposit() / previewMint() / previewWithdraw() / previewRedeem()
  maxDeposit() / maxMint() / maxWithdraw() / maxRedeem()
  → 所有收益金库使用相同接口！
```

### 5.2 核心接口

```solidity
interface IERC4626 is IERC20 {
    // === 底层资产 ===
    // 金库管理的底层资产代币地址（如 USDC）
    function asset() external view returns (address);

    // === 查询函数 ===
    // 金库管理的底层资产总量
    function totalAssets() external view returns (uint256);

    // === 资产 ↔ 份额 换算 ===
    // 给定的底层资产可兑换多少份额（ERC-20 金库代币）
    function convertToShares(uint256 assets) external view returns (uint256);
    // 给定的份额可兑换多少底层资产
    function convertToAssets(uint256 shares) external view returns (uint256);

    // === 存入（两种方式） ===
    // 按底层资产数量存入（返回铸造的份额数）
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    // 按份额数量存入（返回花费的底层资产数量）
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    // === 取款（两种方式） ===
    // 按底层资产数量取款（返回需要销毁的份额数）
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    // 按份额数量取款（返回获得的底层资产数量）
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    // === 预览函数（模拟调用，不修改状态） ===
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);

    // === 上限查询 ===
    function maxDeposit(address receiver) external view returns (uint256);
    function maxMint(address receiver) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);

    // === 事件 ===
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
}
```

### 5.3 deposit vs mint 的区别

```
deposit(assets, receiver) → 返回 shares
  "我出 1000 USDC，给我算算能得多少份额"
  参数是资产，返回值是份额
  适合：用户明确知道要存多少钱

mint(shares, receiver) → 返回 assets
  "我要获得 1000 份额，从我账上划走相应资产"
  参数是份额，返回值是资产
  适合：用户明确知道要获得多少份额
```

### 5.4 Aave V3 的 ERC-4626 实现

Aave V3 为 aToken 实现了 ERC-4626 包装器合约：

```solidity
// Aave V3 的 ERC-4626 Wrapper（简化版）
contract AaveERC4626 is IERC4626, ERC20 {
    IAToken public immutable aToken;

    constructor(IAToken aToken_) {
        aToken = aToken_;
    }

    // 底层资产是 aToken 对应的基础代币
    function asset() external view returns (address) {
        return aToken.UNDERLYING_ASSET_ADDRESS();
    }

    // totalAssets = aToken 余额
    function totalAssets() external view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    // 实现存款
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        // 1. 从用户转走底层资产
        IERC20(asset()).transferFrom(msg.sender, address(this), assets);

        // 2. 将底层资产存入 Aave，获得 aToken
        IERC20(asset()).approve(address(aToken.POOL()), assets);
        aToken.POOL().supply(asset(), assets, address(this), 0);

        // 3. 铸造 ERC-4626 金库份额给接收者
        shares = previewDeposit(assets);
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }
}
```

### 5.5 ERC-4626 安全设计：预览函数

```solidity
// 预览函数的价值：让前端和组合协议在做操作前先看结果

// 用户想存 1000 USDC，先预览能得到多少份额
uint256 expectedShares = vault.previewDeposit(parseEther("1000"));

// 用户想取 500 USDC，先预览需要销毁多少份额
uint256 requiredShares = vault.previewWithdraw(parseEther("500"));

// 检查是否超过限额
uint256 maxCanDeposit = vault.maxDeposit(user);
require(parseEther("1000") <= maxCanDeposit, "deposit limit exceeded");
```

---

## 六、Aave 协议中的标准协作全景

### 6.1 完整交互流程

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Aave 存款 + 借款 完整流程                              │
└──────────────────────────────────────────────────────────────────────┘

  Alice（存款人 + 抵押品提供者）                                   Bob（借款人）
       │                                                            │
       │  ① 离线签名 EIP-712 Permit                                 │
       │     授权 Aave Pool 使用 1000 USDC                          │
       │                                                            │
       │  ② 链上调用 supplyWithPermit()                             │
       │     → ERC-2612 permit 验证签名                             │
       │     → 转走 USDC                                            │
       │     → 铸造 aUSDC（ERC-20 aToken）                         │
       │────────────────────────────────────────>                   │
       │                                                            │
       │  ③ 离线签名 EIP-712 Credit Delegation                      │
       │     授权 Bob 使用 Alice 的信用额度（基于 EIP-712）          │
       │────────────────────────────────────────────────────────>│
       │                                                            │
       │                                         ④ Bob 调用 borrow()│
       │                                            使用 Alice 的信用 │
       │<────────────────────────────────────────────────────────│
       │                                                            │
       │  ⑤ aUSDC 随时间产生利息                                    │
       │     通过 ERC-4626 vault 统一管理                           │
       │     previewRedeem() 随时查看可提取金额                      │
       │                                                            │
       ▼                                                            ▼
```

### 6.2 各标准的分工总结

| 标准 | 在 Aave 中的角色 | 核心贡献 |
|------|-----------------|---------|
| **ERC-20** | aToken（存款凭证）、debtToken（债务凭证） | 将存款和债务"代币化"，可自由转让和组合 |
| **ERC-2612** | supplyWithPermit / repayWithPermit | 存款和还款无需先 approve，一笔交易完成 |
| **EIP-712** | 信用委托签名、治理投票 | 让复杂授权在 MetaMask 中可读、可验证 |
| **ERC-4626** | 收益金库标准化接口 | 统一所有收益协议的存取接口，降低集成成本 |

### 6.3 与 DEX 场景的对比

| 维度 | DEX（Uniswap） | 借贷（Aave） |
|------|---------------|-------------|
| ERC-20 的角色 | 兑换代币 | aToken（存款凭证）+ debtToken（债务凭证） |
| ERC-2612 用途 | swap 前的 token 授权 | supply/repay 前的 token 授权 |
| EIP-712 用途 | Permit 签名 | Permit 签名 + 信用委托签名 |
| ERC-721 用途 | LP 头寸 NFT（V3/V4） | 较少使用 |
| ERC-4626 用途 | 较少使用 | yield-bearing vault 核心接口 |

---

> **学习建议**：Aave 场景下，建议先理解 ERC-4626（这是借贷场景独有且最重要的标准），再回顾 ERC-20 的 aToken 机制（余额自动增长的汇率设计），最后理解 ERC-2612 + EIP-712 在 supplyWithPermit 和信用委托中的组合应用。
