
# NFT（OpenSea）与 ERC/EIP 标准学习文档

## 目录

- [一、概述](#一概述)
- [二、ERC-721：NFT 核心标准](#二erc-721nft-核心标准)
- [三、ERC-1155：多代币标准](#三erc-1155多代币标准)
- [四、ERC-165：接口检测标准](#四erc-165接口检测标准)
- [五、ERC-2981：NFT 版税标准](#五erc-2981nft-版税标准)
- [六、ERC-1271：合约签名验证标准](#六erc-1271合约签名验证标准)
- [七、EIP-712：NFT 挂单签名](#七eip-712nft-挂单签名)
- [八、OpenSea 中的标准协作全景](#八opensea-中的标准协作全景)

---

## 一、概述

### OpenSea 与 NFT 交易流程

OpenSea 是目前最大的 NFT 交易市场，用户可以在上面铸造、购买、出售 NFT。一次典型的交易涉及以下环节：

```
卖方                                     买方
  │                                        │
  │  ① 铸造 NFT（ERC-721 或 ERC-1155）       │
  │  ② 设置版税（ERC-2981）                  │
  │  ③ 挂单出售（EIP-712 链下签名）           │
  │                                        │
  │  ④ OpenSea 撮合交易                     │
  │                                        │
  │                           ⑤ 买方接受挂单 │
  │                           ⑥ 转账 NFT + 支付版税
  │                                        │
  ▼                                        ▼
```

### 涉及的核心标准

| 标准 | 在 NFT/OpenSea 中的角色 |
|------|------------------------|
| **ERC-721** | 标准 NFT（每个 tokenId 唯一） |
| **ERC-1155** | 多代币标准（同个合约管理多种 NFT / 同质化代币） |
| **ERC-165** | 检测合约是否支持某个接口（如是否支持 ERC-2981 版税） |
| **ERC-2981** | 创作者版税标准（二次销售自动分账） |
| **ERC-1271** | 智能合约钱包的签名验证（如 Gnosis Safe 也能签 NFT 挂单） |
| **EIP-712** | 链下挂单签名（免 Gas 上架） |

---

## 二、ERC-721：NFT 核心标准

### 2.1 OpenSea 场景下的 ERC-721

> 接口定义已在前两篇文档中详细列出，这里聚焦 NFT 交易场景的核心要点。

OpenSea 作为交易平台，对 ERC-721 的核心依赖在于**查询所有权**和**执行转账**：

```
铸造：
  collection.mint(to, tokenId)
  → emit Transfer(address(0), to, tokenId)
  → OpenSea 后端监听 Transfer 事件，索引 NFT

上架：
  seller.setApprovalForAll(openseaOperator, true)
  → 授权 OpenSea 的托管合约可以转移卖家的所有 NFT
  → 但 NFT 仍留在卖家钱包中

成交：
  openseaContract.transferFrom(seller, buyer, tokenId)
  → 从卖家转给买家
  → OpenSea 抽取手续费
  → 触发 ERC-2981 版税支付
```

### 2.2 ERC-721 vs ERC-1155 在 OpenSea 上的选择

| 场景 | 推荐标准 | 原因 |
|------|---------|------|
| 单个艺术作品 / PFP | ERC-721 | 每个 NFT 独立，标准清晰 |
| 游戏道具 / 多版本 NFT | ERC-1155 | 同系列多种 tokenId，Gas 更低 |
| 会员卡 / 门票 | ERC-1155 | 同质化+非同质化混合 |
| OpenSea 合集 | 两者都支持 | OpenSea 对两者都有良好兼容 |

---

## 三、ERC-1155：多代币标准

### 3.1 核心概念

**ERC-1155** 是一个"多代币"标准，一个合约可以同时管理**同质化代币**和**非同质化代币**。它解决了 ERC-721 和 ERC-20 各自为战的问题。

```
ERC-20：一个合约 = 一种币（USDC 合约只能管理 USDC）
ERC-721：一个合约 = 一种 NFT 合集（BoredApe 合约只能管理 BAYC）

ERC-1155：一个合约 = 多种代币
  tokenId 0 → 同质化黄金（10000 份，每份等价）
  tokenId 1 → 同质化白银（50000 份，每份等价）
  tokenId 2 → 非同质化屠龙宝刀（仅 1 把）
  tokenId 3 → 非同质化魔法戒指（仅 1 枚）
```

### 3.2 核心接口

```solidity
interface IERC1155 {
    // === 查询 ===
    // 查询某地址持有的某种 tokenId 的数量
    function balanceOf(address account, uint256 id) external view returns (uint256);
    // 批量查询多个 tokenId 的余额
    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata ids
    ) external view returns (uint256[] memory);

    // === 授权 ===
    // 全局授权（类似 ERC-721 的 setApprovalForAll）
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);

    // === 转账 ===
    // 安全转账单个 tokenId
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    // 批量转账（一次转多种 tokenId，大幅节省 Gas）
    function safeBatchTransferFrom(
        address from, address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    // === 事件 ===
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);
}
```

### 3.3 batchTransfer 的 Gas 优势

```solidity
// ERC-721：转 100 个 NFT 需要 100 笔交易
for (uint i = 0; i < 100; i++) {
    nft.transferFrom(seller, buyer, tokenIds[i]);  // 每笔 ~65,000 gas
}
// 总 Gas：100 × 65,000 = 6,500,000 gas

// ERC-1155：转 100 个 NFT 只需 1 笔交易
uint256[] memory ids = [1,2,3,...,100];
uint256[] memory amounts = [1,1,1,...,1];
multiToken.safeBatchTransferFrom(seller, buyer, ids, amounts, "");
// 总 Gas：~150,000 gas（节省约 97%）
```

### 3.4 ERC-1155 的 NFT 判定

ERC-1155 中，一个 tokenId 是否是 NFT 取决于它的**总供应量**：

```solidity
// 判断逻辑
if (totalSupply(tokenId) == 1) {
    // 这是 NFT（非同质化，只有 1 份）
} else if (totalSupply(tokenId) > 1) {
    // 这是同质化代币（有多份）
}
```

### 3.5 元数据扩展

```solidity
// ERC-1155 的 Metadata URI 接口
interface IERC1155MetadataURI is IERC1155 {
    // 返回 tokenId 对应的元数据 URI
    // 与 ERC-721 不同，单个函数服务所有 tokenId
    function uri(uint256 tokenId) external view returns (string memory);
}

// 典型实现：URI 中可包含 {id} 占位符
// 返回：https://api.example.com/metadata/{id}.json
// 客户端将 {id} 替换为实际 tokenId 后请求
```

### 3.6 游戏场景示例

```solidity
contract GameItems is ERC1155 {
    uint256 public constant GOLD = 0;      // 同质化
    uint256 public constant SILVER = 1;    // 同质化
    uint256 public constant SWORD = 2;     // 非同质化
    uint256 public constant SHIELD = 3;    // 非同质化

    function equipBattleGear(address player) external {
        // 一次性转多种道具：黄金、银币、剑、盾
        uint256[] memory ids = [GOLD, SILVER, SWORD, SHIELD];
        uint256[] memory amounts = [100, 50, 1, 1];
        _safeBatchTransferFrom(player, address(this), ids, amounts, "");
    }
}
```

---

## 四、ERC-165：接口检测标准

### 4.1 核心概念

**ERC-165** 是一个极简但非常重要的标准：它允许查询某个合约是否实现了某个接口。在 OpenSea 场景中，平台需要知道 NFT 合约是否支持版税（ERC-2981）、是否支持元数据（ERC-721Metadata）等。

```
OpenSea 检测流程：
  NFT 合约是否支持 ERC-721？
    → 调用 supportsInterface(0x80ac58cd) → true/false

  NFT 合约是否支持 ERC-2981（版税）？
    → 调用 supportsInterface(0x2a55205a) → true/false
    → 如果 true，查询版税信息
    → 如果 false，跳过版税计算
```

### 4.2 核心接口

```solidity
interface IERC165 {
    // 查询合约是否实现了某个接口 ID
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
```

### 4.3 接口 ID 的计算方式

```solidity
// 接口 ID 是该接口所有函数选择器（4 字节）的异或结果
interface IERC721 {
    function balanceOf(address) external view returns (uint256);           // 0x70a08231
    function ownerOf(uint256) external view returns (address);             // 0x6352211e
    function safeTransferFrom(address,address,uint256) external;           // 0x42842e0e
    function transferFrom(address,address,uint256) external;               // 0x23b872dd
    function approve(address,uint256) external;                            // 0x095ea7b3
    function setApprovalForAll(address,bool) external;                     // 0xa22cb465
    function getApproved(uint256) external view returns (address);         // 0x081812fc
    function isApprovedForAll(address,address) external view returns (bool);// 0xe985e9c7
}

// IERC721 的接口 ID = 0x80ac58cd
//     = 0x70a08231 ^ 0x6352211e ^ 0x42842e0e ^ 0x23b872dd
//     ^ 0x095ea7b3 ^ 0xa22cb465 ^ 0x081812fc ^ 0xe985e9c8
```

### 4.4 常见接口 ID 速查表

| 接口 | 接口 ID | 说明 |
|------|---------|------|
| `IERC165` | `0x01ffc9a7` | 接口检测本身 |
| `IERC721` | `0x80ac58cd` | NFT 标准 |
| `IERC721Metadata` | `0x5b5e139f` | NFT 元数据（name/symbol/tokenURI） |
| `IERC721Enumerable` | `0x780e9d63` | NFT 可枚举（totalSupply/tokenByIndex） |
| `IERC1155` | `0xd9b67a26` | 多代币标准 |
| `IERC1155MetadataURI` | `0x0e89341c` | 多代币元数据 |
| `IERC2981` | `0x2a55205a` | NFT 版税标准 |
| `IERC1271` | `0x1626ba7e` | 合约签名验证 |

### 4.5 实现示例

```solidity
contract MyNFT is ERC721, ERC2981 {
    // 四位作者地址，平分版税
    constructor() ERC721("MyNFT", "MNFT") {
        address[] memory creators = [author1, author2, author3, author4];
        uint96[] memory shares = [2500, 2500, 2500, 2500];  // 各 25%
        _setDefaultRoyalty(creators, shares, 500);  // 版税率 5%
    }

    // 必须实现的 supportsInterface，声明本合约支持哪些接口
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        // ERC721 基础上，额外支持 ERC2981
        return
            interfaceId == type(IERC2981).interfaceId ||  // 0x2a55205a
            super.supportsInterface(interfaceId);
    }
}
```

---

## 五、ERC-2981：NFT 版税标准

### 5.1 核心概念

**ERC-2981** 定义了 NFT 版税的标准接口。当 NFT 在二级市场（如 OpenSea）交易时，创作者可以自动获得一定比例的版税分成。

```
传统艺术市场：
  作者卖出画作 → 获得一次性收入
  买家转卖画作 → 作者零收入（除非有法律合同）

ERC-2981 版税：
  作者铸造 NFT → 设置版税率 5%
  买家 A → 买家 B（成交价 1 ETH）
    → 作者自动获得 0.05 ETH（5%）
    → 卖家获得 0.95 ETH（扣除平台费后）
  完全自动执行，无需信任！
```

### 5.2 核心接口

```solidity
interface IERC2981 is IERC165 {
    /**
     * @dev 查询版税信息
     * @param tokenId  NFT 的 tokenId
     * @param salePrice 成交价（以最小单位计，如 wei）
     * @return receiver 版税接收地址
     * @return royaltyAmount 版税金额（与 salePrice 同单位）
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount);
}
```

### 5.3 版税分配模式

**模式一：默认版税（所有 token 使用相同配置）**

```solidity
contract RoyaltyNFT is ERC721, ERC2981 {
    constructor() ERC721("RoyaltyNFT", "RNFT") {
        // 所有 NFT 统一：creator 获得 5% 版税
        _setDefaultRoyalty(creator, 500);  // 500 = 5%（精度 10000）
    }
}
```

**模式二：多接收者版税（按比例分账）**

```solidity
// Aavegotchi 风格：版税分给多个创作者
constructor() {
    address[] memory recipients = [artist, developer, community];
    uint96[] memory shares = [5000, 3000, 2000];
    // artist 50%, developer 30%, community 20%
    _setDefaultRoyalty(recipients, shares, 750);  // 费率 7.5%
}
```

**模式三：按 tokenId 定制版税**

```solidity
function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
    // 每个 NFT 可以有不同的版税率和接收地址
    _setTokenRoyalty(tokenId, receiver, feeNumerator);
}

// OpenSea 查询时会传入具体的 tokenId
// royaltyInfo(888, 1 ether) → (0xArtist, 0.1 ether)  // 10% 版税
// royaltyInfo(999, 1 ether) → (0xCreator, 0.05 ether) // 5% 版税
```

### 5.4 版税率计算

```solidity
// 版税率用万分比表示（分母 10000）
feeNumerator = 500  → 500/10000 = 5%
feeNumerator = 1000 → 1000/10000 = 10%
feeNumerator = 250  → 250/10000 = 2.5%

// royaltyAmount = salePrice × feeNumerator / feeDenominator
// 例如：1 ETH × 500 / 10000 = 0.05 ETH

// 标准分母常量
uint96 public constant _feeDenominator = 10000;
```

### 5.5 OpenSea 的版税执行流程

```
买方出价 1 ETH 买下 NFT
    │
    ▼
OpenSea 撮合合约：
    1. 调用 nft.royaltyInfo(tokenId, 1 ether)
       → 返回 (0xArtist, 0.05 ether)  // 5% 版税
    2. 调用 nft.supportsInterface(0x2a55205a)
       → 返回 true，确认支持 ERC-2981
    │
    ├── 0.05 ETH → 转给创作者 (0xArtist)
    ├── 0.025 ETH → OpenSea 平台费 (2.5%)
    └── 0.925 ETH → 转给卖家
```

---

## 六、ERC-1271：合约签名验证标准

### 6.1 核心概念

传统的签名验证使用 `ecrecover` 从签名恢复 EOA 地址。但如果签名者是**智能合约钱包**（如 Gnosis Safe、ERC-4337 智能账户），`ecrecover` 无法验证。

**ERC-1271** 提供了一个标准方法，让智能合约能够声明"这个签名对我来说是有效的"。

```
场景：Gnosis Safe 多签钱包想要在 OpenSea 上挂单

传统方式（失败）：
  1. Gnosis Safe 签名（需要多个所有者确认）
  2. OpenSea 用 ecrecover 验证
  3. ecrecover 恢复出的是 Gnosis Safe 地址 ✓
  4. 但这不能证明 Safe 内部"同意"了这次签名 ✗

ERC-1271 方式（成功）：
  1. Gnosis Safe 内部执行 isValidSignature() 逻辑
  2. 检查是否达到多签阈值（如 2/3 签名）
  3. 返回 MAGIC_VALUE = 0x1626ba7e
  4. OpenSea 确认签名有效 ✓
```

### 6.2 核心接口

```solidity
interface IERC1271 {
    /**
     * @dev 验证签名是否有效
     * @param hash      待签名消息的哈希
     * @param signature 签名数据（格式由合约钱包自定义）
     * @return magicValue 必须返回 0x1626ba7e 才表示验证通过
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view returns (bytes4 magicValue);

    // 必须返回的魔法值
    // bytes4 public constant MAGIC_VALUE = 0x1626ba7e;
}
```

### 6.3 签名验证流程

```solidity
// OpenSea 等平台的通用签名验证逻辑
function _isValidSignature(
    address signer,       // 可能是 EOA，也可能是合约钱包
    bytes32 hash,         // EIP-712 消息哈希
    bytes memory signature
) internal view returns (bool) {
    // 路径 1：尝试 EOA 验证
    try {
        address recovered = ecrecover(hash, v, r, s);
        if (recovered == signer) return true;
    } catch {}

    // 路径 2：如果 signer 是合约，尝试 ERC-1271 验证
    if (signer.code.length > 0) {
        try IERC1271(signer).isValidSignature(hash, signature) returns (bytes4 result) {
            return result == 0x1626ba7e;  // 检查魔法值
        } catch {
            return false;
        }
    }

    return false;
}
```

### 6.4 Gnosis Safe 的实现

```solidity
// Gnosis Safe 的 ERC-1271 实现（概念简化版）
contract GnosisSafe is IERC1271 {
    mapping(address => bool) public isOwner;
    uint256 public threshold;  // 所需最小签名数

    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4)
    {
        // signature 编码了多个个人签名
        bytes[] memory signatures = abi.decode(signature, (bytes[]));

        uint256 validCount = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ecrecover(hash, v, r, s);  // 从 envelope 恢复
            if (isOwner[signer] && !_seen[_hash(hash)][signer]) {
                validCount++;
            }
        }

        // 达到阈值（如 2/3），返回魔法值
        if (validCount >= threshold) {
            return 0x1626ba7e;  // ERC-1271 魔法值
        }
        return 0xffffffff;
    }
}

// OpenSea 挂单场景：
// 1. 2/3 位 Safe 所有者分别用 EIP-712 签名
// 2. 将多个签名打包进 ERC-1271 signature
// 3. Safe 验证：count >= 2 → 返回 0x1626ba7e
// 4. OpenSea 确认挂单有效
```

---

## 七、EIP-712：NFT 挂单签名

### 7.1 OpenSea 链下挂单

> EIP-712 的基本原理（DOMAIN_SEPARATOR、消息哈希构造公式等）已在前两篇文档中详细说明，这里聚焦 NFT 挂单场景。

OpenSea 的"上架 NFT"采用**链下签名挂单**（Off-chain Orders），卖家不需要支付 Gas：

```
传统链上挂单（需要 Gas）：
  卖家 → approve(marketplace) → listNFT(tokenId, price)
  两笔交易 + Gas 费

OpenSea 链下挂单（免 Gas）：
  卖家 → 用 EIP-712 签名挂单消息 → 发送给 OpenSea 后端
  零交易 + 零 Gas
  
买方接受时：
  买方 → 提交卖家的签名 + NFT 转账 → 一笔交易完成购买
  买方支付 Gas（通常由 OpenSea 的部分撮合方案覆盖）
```

### 7.2 OpenSea 挂单的 EIP-712 结构

```solidity
// Seaport（OpenSea 协议）的挂单数据结构
struct Order {
    address offerer;          // 卖家地址
    address zone;             // 可选附加验证合约
    OfferItem[] offer;        // 卖家提供什么（NFT）
    ConsiderationItem[] consideration; // 卖家想要什么（ETH/代币）
    uint8 orderType;          // 订单类型（全量 / 部分成交）
    uint256 startTime;        // 订单生效时间
    uint256 endTime;          // 订单过期时间
    bytes32 zoneHash;         // zone 合约的额外验证数据哈希
    uint256 salt;             // 随机盐（防重放）
    bytes32 conduitKey;       // 托管渠道的密钥
    uint256 counter;          // 防重放计数器
}

// MetaMask 显示如下：
// ┌────────────────────────────────────┐
// │  Seaport Order                     │
// │                                    │
// │  Offerer:   0xSeller...Address     │
// │  Offer:     BAYC #1234             │
// │  Price:     10 ETH                 │
// │  Expires:   2026-06-01 12:00       │
// └────────────────────────────────────┘
```

### 7.3 链下挂单的执行流程

```
┌───────────────────────────────────────────────────────────────────────┐
│                   OpenSea 链下挂单 + 撮合流程                            │
└───────────────────────────────────────────────────────────────────────┘

  卖方                                       买方                    链上
   │                                          │                       │
   │ ① approve(Seaport, tokenId) 授权一次     │                       │
   │────────────────────────────────────────────────────────────────>│
   │                                          │                       │
   │ ② EIP-712 签名挂单（零 Gas）              │                       │
   │    将签名发给 OpenSea 后端               │                       │
   │                                          │                       │
   │                              ③ 浏览挂单  │                       │
   │                     <───────────────────│                       │
   │                                          │                       │
   │                              ④ 接受挂单  │                       │
   │                              ⑤ 提交卖方的签名 + 付款              │
   │                                          │─────────────────────>│
   │                                          │                       │
   │                                          │  ⑥ 链上验证：          │
   │                                          │     验证 EIP-712 签名 │
   │                                          │     验证订单未过期     │
   │                                          │     执行 NFT 转账      │
   │                                          │     执行版税分配       │
   │                                          │     执行平台费分配     │
   │                                          │                       │
   │  ← 收到 ETH ←────────────────────────────│                       │
   │                                          │                       │
   ▼                                          ▼                       ▼
```

### 7.4 链上撮合合约核心逻辑

```solidity
contract Seaport {
    function fulfillOrder(Order calldata order, bytes calldata signature) external payable {
        // 1. 验证订单结构哈希（EIP-712）
        bytes32 orderHash = _hashTypedData(order);
        address recovered = _recoverSigner(orderHash, signature);
        require(recovered == order.offerer, "invalid signature");

        // 2. 检查订单状态
        require(block.timestamp >= order.startTime, "not started");
        require(block.timestamp <= order.endTime, "expired");
        require(!_isCancelled(orderHash), "cancelled");

        // 3. 如果卖家是合约钱包，走 ERC-1271 验证
        if (order.offerer.code.length > 0) {
            require(
                IERC1271(order.offerer).isValidSignature(orderHash, signature) == 0x1626ba7e,
                "ERC-1271 invalid"
            );
        }

        // 4. 转移 NFT
        for (uint i = 0; i < order.offer.length; i++) {
            _transferToken(order.offer[i].token, order.offerer, msg.sender, order.offer[i].identifier);
        }

        // 5. 分配资金（含 ERC-2981 版税）
        for (uint i = 0; i < order.consideration.length; i++) {
            uint256 amount = order.consideration[i].amount;
            // 验证是否包含版税地址分配
            _transferEth(order.consideration[i].recipient, amount);
        }
    }
}
```

---

## 八、OpenSea 中的标准协作全景

### 8.1 一次完整的 NFT 交易

```
┌────────────────────────────────────────────────────────────────────────┐
│              从铸造到出售的完整标准协作                                    │
└────────────────────────────────────────────────────────────────────────┘

  创作者                                     买方                    OpenSea
    │                                         │                        │
    │ ① 铸造 NFT                               │                        │
    │    继承 ERC-721（或 ERC-1155）            │                        │
    │    声明 supportsInterface → ERC-165     │                        │
    │    设置版税 → ERC-2981                   │                        │
    │───────────────────────────────────────────────────────────────>│
    │                                         │                        │
    │                             ② OpenSea 检测 ERC-165 接口          │
    │                                 supportsInterface(0x80ac58cd)   │
    │                                 → 确认是 ERC-721 ✓              │
    │                                 supportsInterface(0x2a55205a)   │
    │                                 → 确认支持版税 ✓                │
    │                                 royaltyInfo(1, 1 ether)         │
    │                                 → 版税率 5%，接收方 0xArtist     │
    │                                         │                        │
    │ ③ authorize(OpenSea)                    │                        │
    │    → ERC-721 setApprovalForAll          │                        │
    │───────────────────────────────────────────────────────────────>│
    │                                         │                        │
    │ ④ EIP-712 签名挂单（链下，零 Gas）        │                        │
    │───────────────────────────────────────────────────────────────>│
    │                                         │                        │
    │                                         │  ⑤ 浏览并接受挂单       │
    │                                         │─────────────────────>│
    │                                         │                        │
    │                                         │  ⑥ 撮合合约验证：       │
    │                                         │     EIP-712 验证签名   │
    │                                         │     ↓                  │
    │                                         │     ERC-721 transfer   │
    │                                         │     ↓                  │
    │                                         │     ERC-2981 版税分配  │
    │                                         │     ↓                  │
    │                                         │     版税转给创作者      │
    │                                         │                        │
    │  ← 收到版税 ←────────────────────────────│                        │
    │                                         │                        │
    │  ← 收到货款 ←────────────────────────────│                        │
    │                                         │                        │
    ▼                                         ▼                        ▼
```

### 8.2 各标准的分工总结

| 标准 | 在 OpenSea 中的角色 | 核心贡献 |
|------|-------------------|---------|
| **ERC-721** | NFT 的所有权和转账 | 定义 NFT 的基本交互，是所有 NFT 市场的基础 |
| **ERC-1155** | 多代币合集 | 一个合约管理多种 NFT/代币，Gas 节省 97%（批量转账） |
| **ERC-165** | 接口检测 | OpenSea 判断 NFT 合约支持哪些功能（版税/元数据/枚举） |
| **ERC-2981** | 创作者版税 | 二级市场交易自动给创作者分成，无需信任 |
| **ERC-1271** | 合约钱包签名 | Gnosis Safe 等多签/智能账户也能挂单签名 |
| **EIP-712** | 链下挂单签名 | 卖家免 Gas 上架，签名内容在 MetaMask 中可读 |

### 8.3 三篇文档的标准全景对比

| 标准 | DEX（Uniswap） | 借贷（Aave） | NFT（OpenSea） |
|------|:---:|:---:|:---:|
| **ERC-20** | ✅ 代币兑换 | ✅ aToken / debtToken | - |
| **ERC-721** | ✅ LP NFT (V3) | - | ✅ **核心标准** |
| **ERC-1155** | - | - | ✅ **多代币合集** |
| **ERC-165** | - | - | ✅ **接口检测** |
| **ERC-2981** | - | - | ✅ **创作者版税** |
| **ERC-1271** | - | - | ✅ **合约签名** |
| **ERC-2612** | ✅ Permit | ✅ supplyWithPermit | - |
| **ERC-4626** | - | ✅ **Vault 标准** | - |
| **EIP-712** | ✅ Permit 签名 | ✅ Permit + 信用委托 | ✅ **链下挂单** |

---

> **学习建议**：NFT 生态的标准相互依赖——先理解 ERC-721（NFT 是什么）、ERC-165（如何检测它支持什么）、ERC-2981（创作者如何获益）、ERC-1271（合约钱包如何签名）、EIP-712（如何免 Gas 挂单），最后 ERC-1155（多代币的进阶方案）。按照这个顺序阅读，每个标准都是对前一个的自然补充。
