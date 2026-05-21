# 部署指南

## 环境变量配置

### 部署前准备

在部署到测试网（Sepolia）或主网之前，需要配置以下环境变量：

#### 1. 基础配置

创建 `.env` 文件（或使用系统环境变量）：

```bash
# NFT 基础配置
NFT_NAME=Mystery NFT
NFT_SYMBOL=MNFT
NFT_MAX_SUPPLY=10000
NFT_BASE_URI=ipfs://你的IPFS哈希/

# 销售配置
SALE_PRICE=0.08
SALE_MAX_PER_WALLET=10

# VRF 配置（Sepolia 测试网）
SEPOLIA_VRF_COORDINATOR=xxxxxxxx
SEPOLIA_KEY_HASH=xxxxxxxx
SEPOLIA_SUBSCRIPTION_ID=你的订阅ID
SEPOLIA_CALLBACK_GAS_LIMIT=80000
SEPOLIA_REQUEST_CONFIRMATIONS=3
SEPOLIA_VRF_NATIVE_PAYMENT=false

# 私钥（用于部署）
PRIVATE_KEY=你的私钥
```

### NFT_BASE_URI 配置说明

`NFT_BASE_URI` 是 NFT 元数据的基础 URI，用于构建完整的 tokenURI。

#### 配置方式

**方式 1：部署时配置（推荐）**

在部署前设置环境变量：

```bash
# 设置 IPFS 基础 URI
export NFT_BASE_URI=ipfs://QmYourIPFSHash/

# 或者使用 HTTP/HTTPS URL
export NFT_BASE_URI=https://your-domain.com/api/metadata/
```

然后执行部署：

```bash
npx hardhat run scripts/deployWithUUPS.ts --network sepolia
```

**方式 2：部署后更新**

如果部署时使用了占位符 URI，可以在部署后通过合约的 `setBaseURI()` 函数更新：

```bash
# 使用 Hardhat console 或编写脚本
npx hardhat console --network sepolia

# 在 console 中执行
const contract = await ethers.getContractAt("NFTBlindBoxUpgradeable", "你的合约地址");
await contract.setBaseURI("ipfs://QmYourIPFSHash/");
```

或者创建更新脚本：

```typescript
// scripts/updateBaseURI.ts
import { network } from "hardhat";

async function main() {
  const connection = await network.connect();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();

  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  if (!contractAddress) {
    throw new Error("请设置 CONTRACT_ADDRESS 环境变量");
  }

  const newBaseURI = process.env.NFT_BASE_URI || "";
  if (!newBaseURI) {
    throw new Error("请设置 NFT_BASE_URI 环境变量");
  }

  const contract = await ethers.getContractAt(
    "NFTBlindBoxUpgradeable",
    contractAddress
  );

  console.log("更新 Base URI...");
  console.log("合约地址:", contractAddress);
  console.log("新 Base URI:", newBaseURI);

  const tx = await contract.connect(deployer).setBaseURI(newBaseURI);
  await tx.wait();

  console.log("Base URI 更新成功！");
  console.log("交易哈希:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

使用脚本更新：

```bash
export CONTRACT_ADDRESS=你的合约地址
export NFT_BASE_URI=ipfs://QmYourIPFSHash/
npx hardhat run scripts/updateBaseURI.ts --network sepolia
```

#### Base URI 格式要求

1. **IPFS URI**（推荐）：
   ```
   ipfs://QmYourIPFSHash/
   ```
   注意：末尾必须有斜杠 `/`

2. **HTTP/HTTPS URL**：
   ```
   https://your-domain.com/api/metadata/
   ```
   注意：末尾必须有斜杠 `/`

3. **完整路径示例**：
   - Base URI: `ipfs://QmABC123/`
   - Token ID: `0`
   - 稀有度: `Common`
   - 最终 URI: `ipfs://QmABC123/Common/0.json`

#### 线上测试配置步骤

**步骤 1：准备 IPFS 元数据**

1. 准备 NFT 元数据文件（JSON 格式）
2. 上传到 IPFS（使用 Pinata、Infura IPFS 等）
3. 获取 IPFS 哈希（CID）

**步骤 2：设置环境变量**

```bash
# 在 .env 文件中或直接导出
export NFT_BASE_URI=ipfs://QmYourIPFSHash/
```

**步骤 3：部署合约**

```bash
# 部署模块
npx hardhat run scripts/deployModules.ts --network sepolia

# 设置模块地址
export SALE_MANAGER_ADDRESS=0x...
export VRF_HANDLER_ADDRESS=0x...

# 部署主合约（会自动使用 NFT_BASE_URI 环境变量）
npx hardhat run scripts/deployWithUUPS.ts --network sepolia
```

**步骤 4：验证配置**

```bash
# 查询合约的 baseURI
npx hardhat console --network sepolia

const contract = await ethers.getContractAt("NFTBlindBoxUpgradeable", "你的合约地址");
const baseURI = await contract._baseTokenURI();
console.log("Base URI:", baseURI);
```

## 完整部署流程

### 1. 部署模块

```bash
npx hardhat run scripts/deployModules.ts --network sepolia
```

记录输出的地址：
- `SaleManager` 地址
- `VRFHandler` 地址

### 2. 配置 VRF 订阅

参考 [README_VRF_SETUP.md](./README_VRF_SETUP.md)

### 3. 部署主合约

```bash
# 设置环境变量
export SALE_MANAGER_ADDRESS=0x...
export VRF_HANDLER_ADDRESS=0x...
export NFT_BASE_URI=ipfs://QmYourIPFSHash/

# 部署
npx hardhat run scripts/deployWithUUPS.ts --network sepolia
```

### 4. 配置销售参数

参考 [README_SALE.md](./README_SALE.md)

### 5. 验证部署

```bash
# 检查合约状态
npx hardhat console --network sepolia

const contract = await ethers.getContractAt("NFTBlindBoxUpgradeable", "你的合约地址");
console.log("Name:", await contract.name());
console.log("Symbol:", await contract.symbol());
console.log("Base URI:", await contract._baseTokenURI());
```

## 常见问题

### Q: 如何获取 IPFS 哈希？

A: 
1. 使用 [Pinata](https://www.pinata.cloud/) 上传文件
2. 使用 [Infura IPFS](https://www.infura.io/ipfs) 上传文件
3. 使用 IPFS 命令行工具：`ipfs add -r metadata/`

### Q: Base URI 可以更新吗？

A: 可以。合约 owner 可以随时调用 `setBaseURI()` 更新。但建议在部署前就设置好正确的 URI。

### Q: 如果部署时使用了错误的 Base URI 怎么办？

A: 使用 `setBaseURI()` 函数更新即可，无需重新部署合约。

### Q: Base URI 格式有什么要求？

A: 
- 必须以 `/` 结尾
- 支持 `ipfs://`、`https://`、`http://` 协议
- 不能包含具体的文件名（如 `.json`）

### Q: 线上测试时应该使用什么 Base URI？

A: 
- **测试网（Sepolia）**：可以使用 IPFS 或测试服务器 URL
- **主网**：建议使用 IPFS（去中心化、永久存储）

## 参考资源

- [IPFS 文档](https://docs.ipfs.io/)
- [Pinata 上传指南](https://docs.pinata.cloud/)
- [OpenZeppelin ERC721 文档](https://docs.openzeppelin.com/contracts/4.x/erc721)

