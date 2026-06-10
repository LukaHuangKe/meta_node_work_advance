
# AI + Web3：ERC/EIP 标准学习文档

## 目录

- [一、概述：AI Agent 经济的三大支柱](#一概述ai-agent-经济的三大支柱)
- [二、ERC-8004：去信任化 Agent 标准](#二erc-8004去信任化-agent-标准)
- [三、x402：Agent 原生支付协议](#三x402agent-原生支付协议)
- [四、ERC-8183：Agent 商务结算协议](#四erc-8183agent-商务结算协议)
- [五、三大标准协作全景](#五三大标准协作全景)

---

## 一、概述：AI Agent 经济的三大支柱

### 1.1 背景：当 AI Agent 需要自主交易

AI Agent 正在从"辅助工具"进化为"自主执行者"。未来的 Agent 经济中，一个 Agent 需要：

- 发现并信任其他 Agent
- 向其他 Agent 支付费用购买服务
- 按照约定的规则交付、验收、结算

```
传统互联网                         Agent 经济
───────────────────              ───────────────────
用户手动注册账号                   Agent 需要可验证的链上身份
用户手动输入信用卡                  Agent 需要程序化支付能力
平台托管资金 + 人工仲裁              Agent 需要智能合约托管 + 代码仲裁
```

### 1.2 三个标准的定位

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent 经济三大支柱                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ① ERC-8004        ② x402             ③ ERC-8183               │
│   Agent 身份         Agent 支付          Agent 结算               │
│   ┌──────────┐     ┌──────────┐        ┌──────────┐            │
│   │ 身份注册  │     │ HTTP 402 │        │ Job 托管 │            │
│   │ 信誉评分  │     │ 稳定币支付│        │ 状态机   │            │
│   │ 第三方验证│     │ 2秒结算  │        │ 评估者   │            │
│   └──────────┘     └──────────┘        └──────────┘            │
│        │                │                    │                  │
│        ▼                ▼                    ▼                  │
│   "我可以找到你     "我付钱给你"        "确保你交付后再收钱"        │
│    并且信任你"                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 标准 | 角色 | 解决的问题 |
|------|------|-----------|
| **ERC-8004** | 身份与信任 | "谁是你？我能信任你吗？" |
| **x402** | 支付 | "我怎么付钱给你？" |
| **ERC-8183** | 结算 | "我怎么确保你交了货再拿钱？" |

---

## 二、ERC-8004：去信任化 Agent 标准

### 2.1 核心概念

**ERC-8004**（Trustless Agents）为 AI Agent 提供了一套**链上身份、信誉和验证基础设施**。它回答了一个关键问题：在没有预先信任的情况下，Agent 之间如何发现和选择彼此？

> 规范地址：https://eips.ethereum.org/EIPS/eip-8004
> 
> 作者：Coinbase + 以太坊基金会 + Google，2025-08-13
> 
> 依赖：EIP-155、EIP-712、ERC-721、ERC-1271

### 2.2 为什么需要 ERC-8004

现有 Agent 通信协议（A2A、MCP）可以处理**通信**和**任务编排**，但缺少**信任层**：

```
A2A（Agent2Agent）：
  ✅ Agent 身份认证
  ✅ AgentCard 技能描述
  ✅ 直接消息 + 任务生命周期管理
  ❌ 不解决信任问题——你怎么知道 AgentCard 上写的不是假的？

MCP（Model Context Protocol）：
  ✅ 服务器列出能力（prompts、resources、tools）
  ❌ 不解决信任问题——你怎么知道这个 MCP 服务器真的能提供这些能力？

ERC-8004：
  ✅ 补齐信任层——身份注册 + 信誉系统 + 第三方验证
```

### 2.3 三大注册表

ERC-8004 设计了三个轻量级链上注册表：

```
┌────────────────────────────────────────────────────────────────┐
│                    ERC-8004 架构                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ① Identity Registry（身份注册表）                              │
│     基于 ERC-721，每个 Agent 是一个 NFT                          │
│     → tokenURI 解析到 Agent 的注册文件                           │
│     → 包含名称、描述、端点（A2A/MCP/OASF/ENS/DID/wallet）       │
│                                                                │
│  ② Reputation Registry（信誉注册表）                             │
│     客户端给 Agent 打分，分数上链                                 │
│     → 0-100 评分、标签、验证文件                                  │
│     → 支持撤销和追加回复                                         │
│                                                                │
│  ③ Validation Registry（验证注册表）                             │
│     请求并记录第三方验证结果                                      │
│     → 质押者重跑任务                                             │
│     → zkML 验证者                                                │
│     → TEE 预言机                                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.4 Identity Registry：基于 ERC-721 的 Agent 身份

**全局唯一标识符：**

```
agent 全局 ID = {namespace}:{chainId}:{identityRegistry 合约地址}:{agentId}

例如：eip155:1:0x742d35Cc66...:22
      │      │  │              │
      │      │  │              └── ERC-721 tokenId（自增序号）
      │      │  └── 身份注册表合约地址
      │      └── 链 ID（1 = Ethereum 主网）
      └── 链族标识（eip155 = EVM 链）
```

**Agent 注册文件**（存在 IPFS 或 HTTPS，通过 tokenURI 指向）：

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "MySwapAgent",
  "description": "一个自动寻找最优路径的 DEX 交易 Agent",
  "image": "https://example.com/agent.png",
  "services": [
    {
      "name": "A2A",
      "endpoint": "https://agent.example/.well-known/agent-card.json",
      "version": "0.3.0"
    },
    {
      "name": "MCP",
      "endpoint": "https://mcp.agent.eth/",
      "version": "2025-06-18"
    },
    {
      "name": "agentWallet",
      "endpoint": "eip155:1:0x742d35Cc6634C0532925a3b8..."
    }
  ],
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

**关键在于 `supportedTrust` 字段**——它声明 Agent 支持哪些信任模型：

| 信任模型 | 原理 | 适用场景 |
|---------|------|---------|
| `reputation` | 历史评价和打分 | 低风险任务（订外卖） |
| `crypto-economic` | 质押保证金 + 重跑验证 | 中风险任务（代码审计） |
| `tee-attestation` | 可信执行环境（TEE）证明 | 高风险任务（医疗诊断） |
| `zkml` | 零知识机器学习证明 | 高风险 + 隐私保护 |

**核心接口：**

```solidity
// Identity Registry 的核心接口
interface IIdentityRegistry {
    // 注册一个新的 Agent（铸造一个 ERC-721 NFT）
    function register(string calldata agentURI) external returns (uint256 agentId);

    // 更新 Agent 的注册文件 URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    // 设置链上元数据（如技能标签等）
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external;
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory);

    // 设置 Agent 收款钱包（需要 EIP-712 或 ERC-1271 签名证明所有权）
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
    function getAgentWallet(uint256 agentId) external view returns (address);
}
```

### 2.5 Reputation Registry：链上信誉系统

**核心接口：**

```solidity
interface IReputationRegistry {
    // 给 Agent 打分
    // value: 分数（配合 valueDecimals 使用）
    // tag1/tag2: 可选的分类标签，如 "starred"、"responseTime"
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,   // 链下详细评价文件
        bytes32 feedbackHash           // 文件哈希（保证完整性）
    ) external;

    // 撤销评价
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    // 查询总结
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}
```

**评分示例：**

| tag1 | 含义 | 人类可读值 | `value` | `valueDecimals` |
|------|------|-----------|--------|----------------|
| `starred` | 质量评分 (0-100) | 87/100 | 87 | 0 |
| `uptime` | 端点可用率 | 99.77% | 9977 | 2 |
| `responseTime` | 响应时间 (ms) | 560ms | 560 | 0 |
| `successRate` | 成功率 | 89% | 89 | 0 |
| `reachable` | 端点可达（布尔） | true | 1 | 0 |

### 2.6 Validation Registry：第三方验证

对于高风险任务，单靠信誉评分不够。Validation Registry 允许请求第三方独立验证：

```
流程：
  客户端 → Agent 执行任务 → 客户端请求验证
    → 验证者（Staker）重跑任务
    → 或 zkML 证明验证
    → 或 TEE 预言机验证
    → 验证结果记录上链
    → 验证者获得报酬
```

**信任模型是可插拔的**——开发者可以根据任务风险等级选择不同的验证方式，不需要支付统一的高安全成本。

---

## 三、x402：Agent 原生支付协议

### 3.1 核心概念

**x402** 是一个基于 HTTP 402 "Payment Required" 状态码的开放支付协议。它将支付从"人手动操作"变成"HTTP 协议层自动执行"，让 AI Agent 能够**自主支付** API 调用、数据获取等费用。

> 注意：x402 严格来说不是 ERC 标准，而是一个开放协议。但它与 ERC-8004 和 ERC-8183 深度协作，共同构成 Agent 经济基础设施。
> 
> 发布方：Coinbase + Cloudflare，2025-05
> 
> 现状：月处理 7500 万+ 交易，$2400 万+ 交易量，覆盖 Base/Solana/Ethereum/Polygon

### 3.2 为什么需要 x402

传统支付系统是为**人类**设计的，不适用于 AI Agent：

```
传统支付流程（不适合 Agent）：
  1. 打开网站
  2. 注册账号（邮箱/密码）
  3. 绑定信用卡
  4. 选择订阅计划
  5. 获取 API Key
  6. 存储和轮换凭证
  7. 等待交易处理（数秒到数分钟）
  8. 支付平台手续费（2-3%）

x402 支付流程（为 Agent 设计）：
  Agent 发送 HTTP 请求
  → 收到 402 Payment Required 响应
  → 用 USDC 即时支付
  → 获取资源
  → 总耗时约 2 秒！
```

### 3.3 支付流程

```
┌──────────────────────────────────────────────────────────────────┐
│                     x402 支付流程（5 步）                           │
└──────────────────────────────────────────────────────────────────┘

  Client（Agent）                 Server（API）            Facilitator
      │                              │                        │
      │ ① GET /api/data              │                        │
      │─────────────────────────────>│                        │
      │                              │                        │
      │ ② HTTP 402 Payment Required  │                        │
      │    x-price: 0.10 USDC        │                        │
      │    x-pay-to: 0x742d...       │                        │
      │<─────────────────────────────│                        │
      │                              │                        │
      │ ③ 构造支付授权                │                        │
      │    签名（ERC-3009 Permit）     │                        │
      │                              │                        │
      │ ④ GET /api/data              │                        │
      │    X-Payment: <支付凭证>       │                        │
      │─────────────────────────────>│                        │
      │                              │                        │
      │                    ⑤ 验证签名 → 提交链上交易 → 返回确认     │
      │                              │───────────────────────>│
      │                              │<───────────────────────│
      │                              │                        │
      │ ⑥ HTTP 200 OK                │                        │
      │    {"data": "...",            │                        │
      │     "txHash": "0xabc..."}    │                        │
      │<─────────────────────────────│                        │
      │                              │                        │
      ▼                              ▼                        ▼

  总耗时：约 2 秒
```

### 3.4 核心报文格式

**服务端返回 402：**

```json
{
  "type": "x402",
  "version": "2.0",
  "amount": "0.10",
  "currency": "USDC",
  "network": "eip155:8453",           // CAIP-2 格式：Base 链
  "recipient": "0x742d35Cc6635C0532925a3b844Bc9e7595f0bEb7",
  "facilitator": "https://facilitator.example.com"
}
```

**客户端支付请求头：**

```
GET /api/premium-data HTTP/1.1
Host: api.example.com
X-Payment: <base64 编码的支付授权证明>
```

### 3.5 Facilitator（支付协调器）

Facilitator 是 x402 的关键设计——它解决了"API 服务商不想管理 Gas 费"的问题：

```
Facilitator 的职责：
  ✅ 验证客户端的支付签名
  ✅ 代为提交链上交易（服务商不需要有 ETH 付 Gas）
  ✅ 支持多链（Base、Solana、Ethereum、Polygon...）
  ✅ 可选的法币/代币兑换

Facilitator 不做什么：
  ❌ 不托管资金（不会持有用户资产）
  ❌ 不决定交易结果（只做验证和提交）
```

### 3.6 x402 V2 新特性（2026 年初）

| 特性 | 说明 |
|------|------|
| **钱包身份** | Session Token 避免每次请求都支付 |
| **CAIP-2 标识符** | 统一多链标识（如 `eip155:8453`） |
| **动态收款方** | 支持多方分账（平台费 + 服务费） |
| **Bazaar 服务发现** | Agent 自动发现可用的 x402 服务 |
| **无 Gas Permit2** | 用任意 ERC-20 付 Gas，无需 ETH |

### 3.7 代码示例

**服务端集成（一行代码）：**

```javascript
// Express / FastAPI / Next.js / Cloudflare Workers
app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.001",
    currency: "USDC",
    network: "base"
  }
}));

// Agent 请求 /api/data → 自动返回 402
// Agent 支付 → 自动返回 200 + 数据
```

**客户端（Agent）集成：**

```javascript
// Agent 端自动处理 x402 支付
const response = await fetch("https://api.example.com/data", {
  headers: {
    "X-Payment-Wallet": agentWallet,
    "X-Payment-Auto": "true"            // 自动签名并支付
  }
});

// 如果返回 402，x402 客户端库自动：
//   1. 解析支付信息
//   2. 签名 USDC 转账
//   3. 重试请求
//   4. 返回数据
const data = await response.json();      // 直接拿到数据
```

---

## 四、ERC-8183：Agent 商务结算协议

### 4.1 核心概念

**ERC-8183**（Agentic Commerce Protocol）定义了 Agent 之间商业交易的标准流程。核心是一个 **Job**（任务）原语——客户端锁定资金、服务商提交成果、评估者认证完成后放款。

> 规范地址：https://eips.ethereum.org/EIPS/eip-8183
> 
> 作者：以太坊基金会 dAI 团队 + Virtuals Protocol，2026-02-25
> 
> 依赖：ERC-20

### 4.2 为什么需要 ERC-8183

ERC-20 转账只能表达"我给你转了钱"，但对于 Agent 之间的商业交易，需要更丰富的语义：

```
没有 ERC-8183：
  Agent A 给 Agent B 转了 50 USDC
  → 链上只有一个转账记录
  → B 不交付怎么办？A 只能自认倒霉
  → 没有交付证明、没有争议解决机制

有了 ERC-8183：
  Agent A 创建 Job("做一个 Logo") → 资金 50 USDC 进入托管
  → Agent B 提交成果（哈希上链）
  → 评估者认证通过 → 资金释放给 B
  → 或评估者拒绝 → 资金退回给 A
  → 所有操作链上可查、可审计
```

### 4.3 三角色模型

ERC-8183 每笔交易有三个角色：

```
                    ┌──────────────┐
                    │   Evaluator  │
                    │   评估者      │
                    │ "你来判断"    │
                    └──────┬───────┘
                           │
              complete()   │   reject()
                放款        │    退款
                           │
      ┌────────────────────┴────────────────────┐
      │                                         │
┌─────┴─────┐                            ┌──────┴──────┐
│   Client  │  创建 Job + 付款到托管      │  Provider   │
│   客户端   │◄─────────────────────────>│   服务商     │
│  "我要..."  │   提交 deliverable(哈希)   │  "我来做"    │
└───────────┘                            └─────────────┘
```

| 角色 | 职责 | 关键操作 |
|------|------|---------|
| **Client** | 创建任务、托管资金 | `createJob`, `setBudget`, `fund`, 仅 Open 状态可 `reject` |
| **Provider** | 执行任务、提交成果 | `setBudget`（协商价格）, `submit` |
| **Evaluator** | 判断任务是否完成 | `complete`（放款）, `reject`（退款） |

**核心设计**：资金托管后，Client 和 Provider 都不能单方面决定结果。Evaluator 是唯一的裁判。

### 4.4 六状态状态机

```
                 createJob()
                      │
                      ▼
               ┌─────────────┐
               │    Open     │  ← 已创建，未定价/未付款
               │   (开放)     │
               └──────┬──────┘
                      │
        setBudget() + fund()
                      │
                      ▼
               ┌─────────────┐
      ┌───────│   Funded    │───────┐
      │       │  (已托管)    │       │
      │       └──────┬──────┘       │
      │              │              │
      │         submit()            │
      │              │              │
      │              ▼              │
      │       ┌─────────────┐       │
      │       │  Submitted  │       │
      │       │  (已提交)    │       │
      │       └──────┬──────┘       │
      │              │              │
      │    complete()│  │reject()   │  reject()
      │              │  │           │  expire()
      │              ▼  ▼           │
      │    ┌──────────┐ ┌──────────┐│
      │    │Completed │ │ Rejected ││
      │    │ (已完成)  │ │ (已拒绝) ││
      │    │ 放款→     │ │ 退款→    ││
      │    │ Provider │ │ Client   ││
      │    └──────────┘ └──────────┘│
      │                             │
      │              ┌──────────┐   │
      └─────────────>│ Expired  │<──┘
                     │ (已过期)  │
                     │ 退款→     │
                     │ Client   │
                     └──────────┘

  终端状态（灰色）：Completed / Rejected / Expired
  转为终端状态后不可再变更
```

**关键规则：**

| 状态转换 | 谁可以触发 | 条件 |
|---------|-----------|------|
| Open → Funded | Client 调用 `fund()` | budget 已设置，provider 已指定 |
| Open → Rejected | Client 调用 `reject()` | 还没付款，Client 可以反悔 |
| Funded → Submitted | Provider 调用 `submit()` | 只有 Provider 可以提交 |
| Funded → Rejected | **Evaluator** 调用 `reject()` | 在交付前可拒绝 |
| Submitted → Completed | **Evaluator** 调用 `complete()` | 只有 Evaluator 可以放款 |
| Submitted → Rejected | **Evaluator** 调用 `reject()` | 只有 Evaluator 可以拒绝 |
| Funded/Submitted → Expired | 任何人调用 `claimRefund()` | 超过 `expiredAt` |

### 4.5 Job 数据结构

```solidity
struct Job {
    address client;          // 客户端地址
    address provider;        // 服务商地址（可为 0，后面再指定）
    address evaluator;       // 评估者地址（创建时指定，不可更改）
    address token;           // 使用的 ERC-20 代币（每个合约一种）
    uint256 budget;          // 预算金额
    uint256 expiredAt;       // 过期时间戳
    Status status;           // 当前状态
    string description;      // 任务描述
    bytes32 deliverable;     // 交付内容的哈希（Provider 提交时设置）
    bytes32 reason;          // 完成/拒绝的理由哈希（Optional）
    address hook;            // 可选的 Hook 合约地址
}

enum Status { Open, Funded, Submitted, Completed, Rejected, Expired }
```

### 4.6 核心接口

```solidity
interface IAgenticCommerce {
    // 创建任务
    function createJob(
        address provider,        // address(0) 表示稍后指定
        address evaluator,       // 地址不可为 0
        uint256 expiredAt,       // 必须大于当前区块时间
        string calldata description,
        address hook             // 可选，address(0) 表示无 hook
    ) external returns (uint256 jobId);

    // 设置服务商（如果创建时未指定）
    function setProvider(uint256 jobId, address provider, bytes calldata optParams) external;
    // 设置预算（Client 或 Provider 都可以，用于协商）
    function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external;
    // 付款到托管
    function fund(uint256 jobId, uint256 expectedBudget, bytes calldata optParams) external;
    // 提交成果（存入 deliverable 的哈希到链上）
    function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external;
    // 评估者确认完成 → 放款给 Provider
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    // 拒绝（Client 仅在 Open 状态，Evaluator 在 Funded/Submitted 状态）
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    // 过期退款（任何人可调用）
    function claimRefund(uint256 jobId) external;
}
```

### 4.7 Evaluator 的多种形态

Evaluator 是 ERC-8183 最重要的设计。它是可编程的信任层：

```
形态 1：Client = Evaluator（最简单）
  适用于信任关系已建立的场景
  evaluator = client → Client 直接判断是否放款

形态 2：AI Agent 作为 Evaluator
  适用于主观任务（设计、写作）
  Agent 自动评估交付内容质量

形态 3：智能合约作为 Evaluator
  适用于可验证的确定性任务（数据转换、计算）
  合约自动验证提交的 ZK Proof 或结果哈希

形态 4：DAO / 多签作为 Evaluator
  适用于高风险交易
  多个验证者投票决定是否放款
```

### 4.8 Hook 系统（可选扩展）

ERC-8183 设计了 **Hook 系统**，允许在不修改核心协议的情况下扩展功能：

```solidity
interface IACPHook {
    // 在核心操作之前调用
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    // 在核心操作之后调用
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}
```

**Hook 可以做什么：**

```
Before Hook 示例：
  fund() 之前 → KYC 检查 / 白名单验证
  submit() 之前 → 验证 deliverable 格式
  complete() 之前 → 检查信誉分数阈值

After Hook 示例：
  complete() 之后 → 向 ERC-8004 Reputation Registry 写入评价
  fund() 之后 → 触发通知事件
```

**安全设计：**
- `claimRefund()` **不可被 Hook 拦截**——保证过期退款始终可用
- Hook 可 revert 阻止操作（如验证不通过），但无法阻止 `claimRefund`
- 推荐 Hook 使用 `onlyACP` modifier 防止外部直接调用

---

## 五、三大标准协作全景

### 5.1 完整 Agent 交易流程

```
┌──────────────────────────────────────────────────────────────────────┐
│              三个标准在 Agent 交易中的完整协作                            │
└──────────────────────────────────────────────────────────────────────┘

  Client Agent                      Provider Agent                 链上
      │                                  │                          │
      │  ① ERC-8004 发现 Provider        │                          │
      │     查询 Identity Registry      │                          │
      │     获取 AgentCard + 端点       │                          │
      │     检查 Reputation 评分         │                          │
      │─────────────────────────────────────────────────────────>│
      │                                  │                          │
      │  ② x402 支付协商                  │                          │
      │     GET Provider 的定价端点       │                          │
      │     ← 402 Payment Required     │                          │
      │     → 支付少量查询费用            │                          │
      │─────────────────────────────────>│                          │
      │<─────────────────────────────────│                          │
      │                                  │                          │
      │  ③ ERC-8183 创建任务              │                          │
      │     createJob(provider, evaluator)                         │
      │     fund(budget)  ← 资金托管      │                          │
      │─────────────────────────────────────────────────────────>│
      │                                  │                          │
      │                     ④ Provider 执行任务                      │
      │                     ⑤ submit(jobId, deliverable)            │
      │<─────────────────────────────────────────────────────────│
      │                                  │                          │
      │  ⑥ ERC-8183 Evaluator 评估        │                          │
      │     验证 deliverable 哈希         │                          │
      │     complete(jobId, reason)      │                          │
      │─────────────────────────────────────────────────────────>│
      │                                  │                          │
      │                                  │  ⑦ 资金释放给 Provider     │
      │<───────────────────────────────────────────── 50 USDC ──│
      │                                  │                          │
      │  ⑧ ERC-8004 写入信誉              │                          │
      │     giveFeedback(provider, 95)    │                          │
      │─────────────────────────────────────────────────────────>│
      │                                  │                          │
      ▼                                  ▼                          ▼
```

### 5.2 各标准分工总结

| 标准 | 在 AI Agent 经济中的角色 | 核心贡献 |
|------|------------------------|---------|
| **ERC-8004** | Agent 身份与信任基础设施 | 三大注册表（身份、信誉、验证），让 Agent 可发现、可信赖 |
| **x402** | Agent 原生支付协议 | HTTP 402 自动支付，2 秒结算，零手续费，Agent 无需人工介入 |
| **ERC-8183** | Agent 商务结算协议 | Job 托管 + 六状态机 + Evaluator 认证，确保交付后再付款 |

### 5.3 与传统协议的对比

```
                    Web2（人）              Web3 + AI（Agent）
────────────────────────────────────────────────────────────────
  身份              邮箱/手机号             ERC-8004 链上身份 + NFT
  信任              平台信誉系统             ERC-8004 信誉 + 验证注册表
  支付              信用卡/支付宝            x402 HTTP 402 + USDC
  结算              平台托管 + 人工仲裁       ERC-8183 智能合约托管 + 代码仲裁
  确定性             依赖于平台              链上可审计，不可篡改
```

### 5.4 五篇文档的标准全景总览

| 标准 | DEX (Uniswap) | 借贷 (Aave) | NFT (OpenSea) | 钱包 (MetaMask) | AI Agent |
|------|:---:|:---:|:---:|:---:|:---:|
| **ERC-20** | ✅ 代币兑换 | ✅ aToken | - | - | ✅ ERC-8183 依赖 |
| **ERC-721** | ✅ LP NFT | - | ✅ 核心 | - | ✅ ERC-8004 身份 |
| **ERC-1155** | - | - | ✅ 多代币 | - | - |
| **ERC-165** | - | - | ✅ 接口检测 | - | - |
| **ERC-2981** | - | - | ✅ 版税 | - | - |
| **ERC-1271** | - | - | ✅ 合约签名 | - | ✅ ERC-8004 依赖 |
| **ERC-2612** | ✅ Permit | ✅ Permit | - | - | ✅ x402 使用 |
| **ERC-4626** | - | ✅ Vault | - | - | - |
| **ERC-4337** | - | - | - | ✅ 智能钱包 | - |
| **EIP-7702** | - | - | - | ✅ EOA 委托 | - |
| **EIP-712** | ✅ Permit | ✅ Permit | ✅ 挂单 | - | ✅ ERC-8004 依赖 |
| **ERC-8004** | - | - | - | - | ✅ **Agent 身份** |
| **x402** | - | - | - | - | ✅ **Agent 支付** |
| **ERC-8183** | - | - | - | - | ✅ **Agent 结算** |

---

> **学习建议**：AI Agent 经济的三个标准构成了完整的"发现-支付-结算"闭环。建议先理解 ERC-8004（Agent 如何在链上拥有身份和信誉），再理解 x402（Agent 如何无摩擦支付），最后理解 ERC-8183（Agent 如何在无信任环境中安全交易）。三个标准可以独立使用，但组合在一起才构成真正自治的 Agent 经济。
