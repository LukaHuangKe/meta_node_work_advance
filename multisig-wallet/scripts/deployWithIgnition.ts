import { network } from "hardhat";
import DeployMultiSigWalletModule from "../ignition/modules/DeployMultiSigWallet";

/**
 * 结合 Ignition 和手动代理部署多签钱包
 *
 * 此脚本：
 * 1. 使用 Ignition 部署实现合约
 * 2. 手动部署代理合约（不依赖 hardhat-upgrades 插件）
 *
 * 适用于 Hardhat 3.0
 *
 * 使用方法：
 * npx hardhat run scripts/deployWithIgnition.ts --network <network>
 */
async function main() {
    const connection = await network.connect();
    // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
    const { ethers } = connection;
    // @ts-ignore - ignition 属性由 @nomicfoundation/hardhat-ignition 插件添加
    const { ignition } = connection as any;
    const [deployer, owner1, owner2, owner3] = await ethers.getSigners();

    const owners = [owner1.address, owner2.address, owner3.address];
    const numConfirmationsRequired = 2n;

    console.log("Deploying MultiSigWallet with Ignition + Manual Proxy...");
    console.log("Deployer:", deployer.address);
    console.log("Owners:", owners);
    console.log("Required confirmations:", numConfirmationsRequired.toString());

    // 步骤 1: 使用 Ignition 部署实现合约
    console.log("\n[1/4] Deploying implementation using Ignition...");
    const { implementation } = await ignition.deploy(DeployMultiSigWalletModule);
    const implementationAddress = await implementation.getAddress();
    console.log("Implementation deployed at:", implementationAddress);

    // 步骤 2: 部署 ProxyAdmin
    console.log("\n[2/4] Deploying ProxyAdmin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("ProxyAdmin deployed at:", proxyAdminAddress);

    // 步骤 3: 准备初始化数据
    console.log("\n[3/4] Preparing initialization data...");
    const initializeInterface = new ethers.Interface([
        "function initialize(address[] memory _owners, uint256 _numConfirmationsRequired)"
    ]);
    const initData = initializeInterface.encodeFunctionData("initialize", [
        owners,
        numConfirmationsRequired,
    ]);
    console.log("Initialization data prepared");

    // 步骤 4: 部署 TransparentUpgradeableProxy
    console.log("\n[4/4] Deploying TransparentUpgradeableProxy...");
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
        "TransparentUpgradeableProxy"
    );
    const proxy = await TransparentUpgradeableProxy.deploy(
        implementationAddress, // implementation
        proxyAdminAddress, // admin
        initData // data (initialization call)
    );
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("Proxy deployed at:", proxyAddress);

    // 验证部署
    console.log("\n=== Verifying Deployment ===");
    const wallet = await ethers.getContractAt(
        "MultiSigWalletUpgradeable",
        proxyAddress
    );

    const walletOwners = await wallet.getOwners();
    const threshold = await wallet.getThreshold();

    console.log("Proxy Address:", proxyAddress);
    console.log("Implementation Address:", implementationAddress);
    console.log("ProxyAdmin Address:", proxyAdminAddress);
    console.log("Owners:", walletOwners);
    console.log("Threshold:", threshold.toString());

    return {
        proxy: proxyAddress,
        implementation: implementationAddress,
        admin: proxyAdminAddress,
    };
}

main()
    .then((result) => {
        console.log("\nDeployment successful!");
        console.log("\n=== Deployment Summary ===");
        console.log("Proxy Address:", result.proxy);
        console.log("Implementation Address:", result.implementation);
        console.log("ProxyAdmin Address:", result.admin);
        console.log("\nSave these addresses for future upgrades!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\nDeployment failed:");
        console.error(error);
        process.exit(1);
    });