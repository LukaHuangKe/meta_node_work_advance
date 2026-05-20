import { network } from "hardhat";

/**
 * 升级多签钱包合约
 *
 * 使用方法：
 * PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.ts --network <network>
 *
 * 环境变量配置：
 * - PROXY_ADDRESS: 代理合约地址（必需）
 * - {NETWORK}_PROXY_ADMIN_OWNER: ProxyAdmin 的所有者地址（可选，用于验证）
 *
 * 示例：
 * PROXY_ADDRESS=0x... SEPOLIA_PROXY_ADMIN_OWNER=0x... npx hardhat run scripts/upgrade.ts --network sepolia
 */
async function main() {
    const connection = await network.connect();
    // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
    const { ethers } = connection;

    // 这整个方法都是需要使用Proxy Admin Owner来调用的！
    const [deployer] = await ethers.getSigners();

    // 获取当前网络信息
    const networkInfo = await ethers.provider.getNetwork();
    const chainId = Number(networkInfo.chainId);

    // 获取网络名称（从命令行参数或环境变量）
    let networkName = process.env.HARDHAT_NETWORK;
    if (!networkName) {
        // 尝试从命令行参数中获取
        const networkIndex = process.argv.indexOf("--network");
        if (networkIndex !== -1 && process.argv[networkIndex + 1]) {
            networkName = process.argv[networkIndex + 1];
        } else {
            // 根据 chainId 判断
            if (chainId === 31337) {
                networkName = "hardhat";
            } else if (chainId === 11155111) {
                networkName = "sepolia";
            } else if (chainId === 1) {
                networkName = "mainnet";
            } else if (chainId === 5) {
                networkName = "goerli";
            } else {
                networkName = "unknown";
            }
        }
    }

    // 从环境变量或参数获取代理地址
    const proxyAddress =
        process.env.PROXY_ADDRESS ||
        process.argv[2] ||
        "0x0000000000000000000000000000000000000000";

    if (proxyAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(
            "Please provide proxy address via PROXY_ADDRESS env var or as first argument"
        );
    }

    console.log("Upgrading MultiSigWallet...");
    console.log(`Network: ${networkName} (Chain ID: ${chainId})`);
    console.log("Deployer:", deployer.address);
    console.log("Proxy Address:", proxyAddress);

    // 获取当前实现合约地址
    const ERC1967_PROXY_STORAGE_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const currentImplementationStorage = await ethers.provider.getStorage(
        proxyAddress,
        ERC1967_PROXY_STORAGE_SLOT
    );
    const implStorageHex = currentImplementationStorage.startsWith("0x")
        ? currentImplementationStorage.slice(2)
        : currentImplementationStorage;
    const currentImpl = ethers.getAddress("0x" + implStorageHex.slice(-40).padStart(40, '0'));
    console.log("Current Implementation:", currentImpl);

    // 获取 ProxyAdmin 地址
    const ERC1967_ADMIN_STORAGE_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const adminStorage = await ethers.provider.getStorage(
        proxyAddress,
        ERC1967_ADMIN_STORAGE_SLOT
    );
    const adminStorageHex = adminStorage.startsWith("0x") ? adminStorage.slice(2) : adminStorage;
    const proxyAdminAddress = ethers.getAddress("0x" + adminStorageHex.slice(-40).padStart(40, '0'));
    console.log("ProxyAdmin Address:", proxyAdminAddress);

    // 步骤 1: 部署新版本的实现合约
    console.log("\n[1/4] Deploying new implementation contract...");
    const MultiSigWalletV2 = await ethers.getContractFactory("MultiSigWalletV2");
    const newImplementation = await MultiSigWalletV2.deploy();
    await newImplementation.waitForDeployment();
    const newImplementationAddress = await newImplementation.getAddress();
    console.log("New Implementation:", newImplementationAddress);

    // 步骤 2: 验证 ProxyAdmin 所有者
    console.log("\n[2/4] Verifying ProxyAdmin owner...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = ProxyAdmin.attach(proxyAdminAddress);
    const adminOwner = await proxyAdmin.owner();
    console.log("ProxyAdmin Owner:", adminOwner);

    // 验证所有者地址不是 ProxyAdmin 地址本身
    if (adminOwner.toLowerCase() === proxyAdminAddress.toLowerCase()) {
        throw new Error(
            `ProxyAdmin 的所有者地址与 ProxyAdmin 地址相同，这是不正确的配置。`
        );
    }

    // 从环境变量获取期望的 ProxyAdmin 所有者（如果配置了）
    const expectedOwnerEnvKey = `${networkName.toUpperCase()}_PROXY_ADMIN_OWNER`;
    const expectedOwnerFromEnv = process.env[expectedOwnerEnvKey];

    if (expectedOwnerFromEnv) {
        const expectedOwner = ethers.getAddress(expectedOwnerFromEnv);
        if (expectedOwner.toLowerCase() !== adminOwner.toLowerCase()) {
            throw new Error(
                `环境变量配置的 ProxyAdmin 所有者 (${expectedOwner}) 与链上的实际所有者 (${adminOwner}) 不匹配。`
            );
        }
    }

    // 检查部署者是否是 ProxyAdmin 的所有者
    if (adminOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(
            `Deployer (${deployer.address}) is not the owner of ProxyAdmin (${adminOwner}). ` +
            `请使用地址 ${adminOwner} 对应的私钥配置 ${networkName.toUpperCase()}_PRIVATE_KEY`
        );
    }

    // 步骤 3: 执行升级
    console.log("\n[3/4] Executing upgrade...");
    const upgradeTx = await proxyAdmin.upgradeAndCall(
        proxyAddress,
        newImplementationAddress,
        "0x"
    );
    console.log("Transaction hash:", upgradeTx.hash);
    await upgradeTx.wait();
    console.log("✓ Upgrade transaction confirmed");

    // 验证新实现地址
    const newImplStorage = await ethers.provider.getStorage(
        proxyAddress,
        ERC1967_PROXY_STORAGE_SLOT
    );
    const newImplStorageHex = newImplStorage.startsWith("0x")
        ? newImplStorage.slice(2)
        : newImplStorage;
    const verifiedNewImpl = ethers.getAddress("0x" + newImplStorageHex.slice(-40).padStart(40, '0'));
    if (verifiedNewImpl.toLowerCase() !== newImplementationAddress.toLowerCase()) {
        throw new Error(
            `升级验证失败：实现地址不匹配。期望: ${newImplementationAddress}, 实际: ${verifiedNewImpl}`
        );
    }

    // 步骤 4: 初始化 V2 功能并验证
    console.log("\n[4/4] Initializing V2 features and verifying...");
    const wallet = await ethers.getContractAt("MultiSigWalletV2", proxyAddress);
    try {
        await wallet.version();
    } catch (error: any) {
        if (error.message.includes("version") || error.message.includes("revert")) {
            console.log("Initializing V2...");
            const initTx = await wallet.initializeV2(2);
            await initTx.wait();
            console.log("✓ V2 initialization completed");
        } else {
            throw error;
        }
    }

    // 最终验证
    const finalVersion = await wallet.version();
    const owners = await wallet.getOwners();
    const threshold = await wallet.getThreshold();

    console.log("\n=== Upgrade Summary ===");
    console.log("Proxy Address:", proxyAddress);
    console.log("New Implementation:", newImplementationAddress);
    console.log("Version:", finalVersion.toString());
    console.log("Owners:", owners.length);
    console.log("Threshold:", threshold.toString());

    return {
        proxy: proxyAddress,
        implementation: newImplementationAddress,
        version: finalVersion.toString(),
    };
}

main()
    .then(() => {
        console.log("\n✓ Upgrade successful");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n✗ Upgrade failed:");
        console.error(error);
        process.exit(1);
    });