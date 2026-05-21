import { expect } from "chai";
import { network } from "hardhat";
import { createRequire } from "module";
// 导入类型扩展以支持 hre.upgrades
import "@openzeppelin/hardhat-upgrades";
// 导入 Chai matchers 以支持 revertedWithCustomError
import "@nomicfoundation/hardhat-ethers-chai-matchers";

const require = createRequire(import.meta.url);

// 获取网络连接和辅助工具
let networkHelpers: any;
let ethersInstance: any;

before(async function () {
  const connection = await network.connect();
  // @ts-ignore - networkHelpers 和 ethers 属性由插件添加
  networkHelpers = connection.networkHelpers;
  // @ts-ignore
  ethersInstance = connection.ethers;
});

/**
 * 手动部署 UUPS 代理（因为 hre.upgrades 在 Hardhat 3 中不可用）
 */
async function deployUUPSProxy(
  ContractFactory: any,
  initArgs: any[],
  signer: any
) {
  const ethers = ethersInstance;
  
  // 1. 部署实现合约
  const implementation = await ContractFactory.connect(signer).deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  // 2. 获取初始化数据
  const initData = ContractFactory.interface.encodeFunctionData("initialize", initArgs);

  // 3. 从 OpenZeppelin 的 artifact 读取 ERC1967Proxy
  const ERC1967ProxyArtifact = require("@openzeppelin/contracts/build/contracts/ERC1967Proxy.json");
  const ERC1967ProxyFactory = new ethers.ContractFactory(
    ERC1967ProxyArtifact.abi,
    ERC1967ProxyArtifact.bytecode,
    signer
  );
  
  // 4. 部署代理
  const proxy = await ERC1967ProxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  // 5. 返回代理合约实例
  return await ethers.getContractAt(ContractFactory.interface, proxyAddress);
}

/**
 * 手动升级 UUPS 代理（因为 hre.upgrades 在 Hardhat 3 中不可用）
 */
async function upgradeUUPSProxy(
  proxyAddress: string,
  NewImplementationFactory: any,
  signer: any
) {
  const ethers = ethersInstance;
  
  // 1. 部署新的实现合约
  const newImplementation = await NewImplementationFactory.connect(signer).deploy();
  await newImplementation.waitForDeployment();
  const newImplementationAddress = await newImplementation.getAddress();

  // 2. 获取代理合约实例（使用新实现的接口）
  // 在 UUPS 模式中，upgradeToAndCall 函数在实现合约中（继承自 UUPSUpgradeable）
  const proxy = await ethers.getContractAt(
    NewImplementationFactory.interface,
    proxyAddress
  );

  // 3. 调用 upgradeToAndCall 函数（UUPS 模式）
  // upgradeToAndCall 是 UUPSUpgradeable 提供的公共函数，可以通过代理调用
  // 传入空数据，只升级不调用初始化函数
  const upgradeTx = await proxy.connect(signer).upgradeToAndCall(
    newImplementationAddress,
    "0x" // 空数据，只升级
  );
  await upgradeTx.wait();

  // 4. 返回升级后的代理合约实例
  return await ethers.getContractAt(NewImplementationFactory.interface, proxyAddress);
}

describe("NFTBlindBox", function () {
  // 定义 Fixture 函数
  async function deployNFTBlindBoxFixture() {
    // 使用全局的 ethersInstance
    const ethers = ethersInstance;
    const [owner, buyer1, buyer2, whitelistedUser] = await ethers.getSigners();

    const name = "Mystery NFT";
    const symbol = "MNFT";
    const maxSupply = 10000n;
    const price = ethers.parseEther("0.08");
    const baseURI = "ipfs://QmTestBaseURI/";

    // VRF配置（使用零地址作为占位符，实际测试需要mock）
    const vrfCoordinator = ethers.ZeroAddress;
    const keyHash =
      "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
    const subscriptionId = 1n;
    const callbackGasLimit = 100000;
    const requestConfirmations = 3;

    // 部署SaleManager模块（使用手动 UUPS 代理部署）
    const SaleManager = await ethers.getContractFactory("SaleManager");
    const saleManagerProxy = await deployUUPSProxy(
      SaleManager,
      [price, 10n], // price, maxPerWallet
      owner
    );
    const saleManagerAddress = await saleManagerProxy.getAddress();

    // 部署VRFHandler模块（使用手动 UUPS 代理部署）
    const VRFHandler = await ethers.getContractFactory("VRFHandler");
    const vrfHandlerProxy = await deployUUPSProxy(
      VRFHandler,
      [
        vrfCoordinator,
        keyHash,
        subscriptionId,
        callbackGasLimit,
        requestConfirmations,
      ],
      owner
    );
    const vrfHandlerAddress = await vrfHandlerProxy.getAddress();

    // 部署主合约（使用手动 UUPS 代理部署）
    const NFTBlindBoxUpgradeable = await ethers.getContractFactory(
      "NFTBlindBoxUpgradeable"
    );

    const proxy = await deployUUPSProxy(
      NFTBlindBoxUpgradeable,
      [
        name,
        symbol,
        maxSupply,
        price, // 这个参数在新的initialize中已经移除了，但为了兼容测试先保留
        saleManagerAddress,
        vrfHandlerAddress,
        baseURI,
      ],
      owner
    );

    const proxyAddress = await proxy.getAddress();

    const blindBox = await ethers.getContractAt(
      "NFTBlindBoxUpgradeable",
      proxyAddress
    );

    // 获取SaleManager实例
    const saleManager = await ethers.getContractAt(
      "SaleManager",
      saleManagerAddress
    );

    return {
      blindBox,
      saleManager,
      owner,
      buyer1,
      buyer2,
      whitelistedUser,
      name,
      symbol,
      maxSupply,
      price,
      proxyAddress,
      saleManagerAddress,
      vrfHandlerAddress,
    };
  }

  // 测试套件：部署测试
  describe("Deployment", function () {
    // 测试用例：正确初始化
    it("Should deploy with correct parameters", async function () {
      const { blindBox, name, symbol, maxSupply } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      expect(await blindBox.name()).to.equal(name);
      expect(await blindBox.symbol()).to.equal(symbol);
      expect(await blindBox.maxSupply()).to.equal(maxSupply);
    });

    // 测试用例：初始状态
    it("Should have correct initial state", async function () {
      const { blindBox } = await networkHelpers.loadFixture(deployNFTBlindBoxFixture);

      expect(await blindBox.totalSupply()).to.equal(0n);

      // 通过SaleManager查询销售状态
      const saleManagerAddress = await blindBox.saleManager();
      const saleManager = await ethersInstance.getContractAt(
        "SaleManager",
        saleManagerAddress
      );
      expect(await saleManager.saleActive()).to.be.false;
      expect(await saleManager.currentPhase()).to.equal(0); // NotStarted
    });

    // 测试用例：模块连接正确
    it("Should connect to modules correctly", async function () {
      const { blindBox, saleManagerAddress, vrfHandlerAddress } =
        await networkHelpers.loadFixture(deployNFTBlindBoxFixture);

      expect(await blindBox.saleManager()).to.equal(saleManagerAddress);
      expect(await blindBox.vrfHandler()).to.equal(vrfHandlerAddress);
    });
  });

  // 测试套件：销售管理测试
  describe("Sale Management", function () {
    // 测试用例：设置价格（通过SaleManager）
    it("Should allow owner to set price", async function () {
      const { saleManager, owner } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );
      const newPrice = ethersInstance.parseEther("0.1");

      // 设置SaleManager的价格
      await saleManager.connect(owner).setPrice(newPrice);
      expect(await saleManager.price()).to.equal(newPrice);
    });

    // 测试用例：设置销售状态
    it("Should allow owner to set sale active", async function () {
      const { saleManager, owner } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      await saleManager.connect(owner).setSaleActive(true);
      expect(await saleManager.saleActive()).to.be.true;
    });

    // 测试用例：设置销售阶段
    it("Should allow owner to set sale phase", async function () {
      const connection = await network.connect();
      // @ts-ignore - networkHelpers 属性由插件添加
      const { networkHelpers } = connection;
      const { saleManager, owner } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      await saleManager.connect(owner).setSalePhase(2); // Public
      expect(await saleManager.currentPhase()).to.equal(2);
      expect(await saleManager.saleActive()).to.be.true;
    });

    // 测试用例：拒绝非所有者操作
    it("Should revert when non-owner tries to set price", async function () {
      const { saleManager, buyer1 } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );
      const newPrice = ethersInstance.parseEther("0.1");

      await expect(
        saleManager.connect(buyer1).setPrice(newPrice)
      ).to.be.revertedWithCustomError(saleManager, "OwnableUnauthorizedAccount");
    });
  });

  // 测试套件：白名单管理测试
  describe("Whitelist Management", function () {
    // 测试用例：添加白名单
    it("Should allow owner to add whitelist", async function () {
      const { saleManager, owner, whitelistedUser } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      await saleManager
        .connect(owner)
        .addToWhitelist([whitelistedUser.address]);
      expect(await saleManager.whitelist(whitelistedUser.address)).to.be.true;
    });

    // 测试用例：移除白名单
    it("Should allow owner to remove whitelist", async function () {
      const connection = await network.connect();
      // @ts-ignore - networkHelpers 属性由插件添加
      const { networkHelpers } = connection;
      const { saleManager, owner, whitelistedUser } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      await saleManager
        .connect(owner)
        .addToWhitelist([whitelistedUser.address]);
      await saleManager
        .connect(owner)
        .removeFromWhitelist([whitelistedUser.address]);
      expect(await saleManager.whitelist(whitelistedUser.address)).to.be.false;
    });
  });

  // 测试套件：元数据管理测试
  describe("Metadata Management", function () {
    // 测试用例：设置baseURI
    it("Should allow owner to set base URI", async function () {
      const { blindBox, owner } = await networkHelpers.loadFixture(deployNFTBlindBoxFixture);
      const newBaseURI = "ipfs://QmNewBaseURI/";

      await blindBox.connect(owner).setBaseURI(newBaseURI);
      // 注意：由于tokenURI的复杂逻辑，这里只测试函数执行成功
    });

    // 测试用例：未揭示时的URI
    it("Should return blindbox URI for unrevealed tokens", async function () {
      const { owner, saleManager } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      // 开启销售
      await saleManager.connect(owner).setSaleActive(true);
      await saleManager.connect(owner).setSalePhase(2); // Public

      // 注意：购买盲盒需要VRF回调，实际测试需要mock VRF
      // 这里只是展示测试结构
      // const { blindBox, buyer1 } = await networkHelpers.loadFixture(deployNFTBlindBoxFixture);
      // await blindBox.connect(buyer1).purchaseBox({ value: await saleManager.price() });
    });
  });

  // 测试套件：辅助函数测试
  describe("Helper Functions", function () {
    // 测试用例：查询盲盒状态
    it("Should return correct blind box status", async function () {
      const { blindBox } = await networkHelpers.loadFixture(deployNFTBlindBoxFixture);

      // 对于不存在的token，应该返回false
      const [purchased, revealed] = await blindBox.getBlindBoxStatus(0);
      expect(purchased).to.be.false;
      expect(revealed).to.be.false;
    });
  });

  // 测试套件：升级测试
  describe("Upgrade", function () {
    // 测试用例：升级到V2
    it("Should upgrade to V2 successfully", async function () {
      const { proxyAddress } = await networkHelpers.loadFixture(
        deployNFTBlindBoxFixture
      );

      const NFTBlindBoxV2 = await ethersInstance.getContractFactory("NFTBlindBoxV2");
      const { owner } = await networkHelpers.loadFixture(deployNFTBlindBoxFixture);

      // 使用手动升级函数
      const upgraded = await upgradeUUPSProxy(
        proxyAddress,
        NFTBlindBoxV2,
        owner
      );

      const upgradedAddress = await upgraded.getAddress();

      expect(upgradedAddress).to.equal(proxyAddress); // 代理地址不变

      // 调用V2的初始化
      const blindBoxV2 = await ethersInstance.getContractAt(
        "NFTBlindBoxV2",
        upgradedAddress
      );
      await blindBoxV2.initializeV2(2);

      // 验证V2功能
      const version = await blindBoxV2.version();
      expect(version).to.equal(2n);
    });
  });
});
