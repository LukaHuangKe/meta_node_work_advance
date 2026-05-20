import { network } from "hardhat";

/**
 * 手动部署多签钱包（透明代理模式）
 *
 *
 * 使用方法：
 * npx hardhat run scripts/deployWithProxy.ts --network <network>
 *
 * 环境变量配置：
 * - {NETWORK}_OWNER_ADDRESSES: 多签钱包的所有者地址（逗号分隔）
 * - {NETWORK}_PROXY_ADMIN_OWNER: ProxyAdmin 的所有者地址（可选，默认使用部署者）
 * - USE_FIRST_OWNER_AS_PROXY_ADMIN: 设置为 "true" 时，使用多签钱包第一个所有者作为 ProxyAdmin 所有者
 *
 * 示例：
 * SEPOLIA_OWNER_ADDRESSES=0x地址1,0x地址2,0x地址3
 * SEPOLIA_PROXY_ADMIN_OWNER=0x地址1  # 可选，指定 ProxyAdmin 所有者
 * # 或者
 * USE_FIRST_OWNER_AS_PROXY_ADMIN=true  # 使用第一个所有者作为 ProxyAdmin 所有者
 */
async function main() {
    const connection = await network.connect();
    // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
    const { ethers } = connection;
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    // 获取当前网络信息
    const networkInfo = await ethers.provider.getNetwork();
    const chainId = Number(networkInfo.chainId);

    // 获取网络名称（从命令行参数或环境变量）
    // Hardhat 3.0 中，网络名称通过 --network 参数传递，存储在 process.argv 中
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

    console.log(`当前网络: ${networkName} (Chain ID: ${chainId})`);

    // 根据网络类型获取所有者地址
    let owners: string[];

    if (networkName === "hardhat" || networkName === "localhost" || chainId === 31337) {
        // 本地网络：使用自动生成的测试账户
        if (signers.length < 4) {
            throw new Error("本地网络需要至少4个账户（1个部署者 + 3个所有者）");
        }
        owners = [signers[1].address, signers[2].address, signers[3].address];
        console.log("使用本地网络自动生成的账户作为所有者");
    } else {
        // 外部网络：从环境变量读取所有者地址
        const envKey = `${networkName.toUpperCase()}_OWNER_ADDRESSES`;
        const ownerAddressesStr = process.env[envKey];

        if (!ownerAddressesStr || ownerAddressesStr.trim() === "") {
            throw new Error(
                `未配置 ${envKey} 环境变量。\n` +
                `请在 .env 文件中添加：\n` +
                `${envKey}=0x地址1,0x地址2,0x地址3\n` +
                `当前网络名称: ${networkName}, Chain ID: ${chainId}`
            );
        }

        // 解析地址列表（用逗号分隔）
        owners = ownerAddressesStr
            .split(",")
            .map(addr => addr.trim())
            .filter(addr => addr !== "");

        if (owners.length < 3) {
            throw new Error(`至少需要3个所有者地址，当前配置了 ${owners.length} 个`);
        }

        // 验证地址格式
        for (const addr of owners) {
            if (!ethers.isAddress(addr)) {
                throw new Error(`无效的地址格式: ${addr}`);
            }
        }

        // 转换为 checksum 地址
        owners = owners.map(addr => ethers.getAddress(addr));

        console.log(`从环境变量 ${envKey} 读取所有者地址`);
    }

    const numConfirmationsRequired = 2n;

    // 确定 ProxyAdmin 的所有者
    // 优先级：环境变量 > 多签钱包第一个所有者 > 部署者
    let proxyAdminOwner: string;
    const proxyAdminOwnerEnvKey = `${networkName.toUpperCase()}_PROXY_ADMIN_OWNER`;
    const proxyAdminOwnerEnv = process.env[proxyAdminOwnerEnvKey];

    if (proxyAdminOwnerEnv && proxyAdminOwnerEnv.trim() !== "") {
        // 方式1: 从环境变量读取（最高优先级）
        if (!ethers.isAddress(proxyAdminOwnerEnv)) {
            throw new Error(`无效的 ProxyAdmin 所有者地址: ${proxyAdminOwnerEnv}`);
        }
        proxyAdminOwner = ethers.getAddress(proxyAdminOwnerEnv);
        console.log(`从环境变量 ${proxyAdminOwnerEnvKey} 读取 ProxyAdmin 所有者`);
    } else if (process.env.USE_FIRST_OWNER_AS_PROXY_ADMIN === "true") {
        // 方式2: 使用多签钱包的第一个所有者
        proxyAdminOwner = owners[0];
        console.log("使用多签钱包的第一个所有者作为 ProxyAdmin 所有者");
    } else {
        // 方式3: 默认使用部署者地址
        proxyAdminOwner = deployer.address;
        console.log("使用部署者地址作为 ProxyAdmin 所有者");
    }

    console.log("Deploying MultiSigWallet with Transparent Proxy...");
    console.log("Deployer:", deployer.address);
    console.log("ProxyAdmin Owner:", proxyAdminOwner);
    console.log("Owners:", owners);
    console.log("Required confirmations:", numConfirmationsRequired.toString());

    // 部署实现合约
    console.log("\nDeploying implementation contract...");
    const MultiSigWalletUpgradeable = await ethers.getContractFactory(
        "MultiSigWalletUpgradeable"
    );
    const implementation = await MultiSigWalletUpgradeable.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log("Implementation:", implementationAddress);

    // 验证 ProxyAdmin 所有者地址
    if (!ethers.isAddress(proxyAdminOwner) || proxyAdminOwner === ethers.ZeroAddress) {
        throw new Error(`无效的 ProxyAdmin 所有者地址: ${proxyAdminOwner}`);
    }

    // 准备初始化数据
    const initializeInterface = new ethers.Interface([
        "function initialize(address[] memory _owners, uint256 _numConfirmationsRequired)"
    ]);
    const initData = initializeInterface.encodeFunctionData("initialize", [
        owners,
        numConfirmationsRequired,
    ]);

    // 部署 TransparentUpgradeableProxy
    console.log("Deploying TransparentUpgradeableProxy...");
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
        "TransparentUpgradeableProxy"
    );
    const proxy = await TransparentUpgradeableProxy.deploy(
        implementationAddress,
        proxyAdminOwner,
        initData
    );
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();

    // 从存储槽读取 ProxyAdmin 地址并验证
    const ERC1967_ADMIN_STORAGE_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const adminStorage = await ethers.provider.getStorage(
        proxyAddress,
        ERC1967_ADMIN_STORAGE_SLOT
    );
    const adminStorageHex = adminStorage.startsWith("0x") ? adminStorage.slice(2) : adminStorage;
    const actualProxyAdminAddress = ethers.getAddress("0x" + adminStorageHex.slice(-40).padStart(40, '0'));

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = ProxyAdmin.attach(actualProxyAdminAddress);
    const actualProxyAdminOwner = await proxyAdmin.owner();

    if (actualProxyAdminOwner.toLowerCase() !== proxyAdminOwner.toLowerCase()) {
        throw new Error(
            `ProxyAdmin 所有者设置失败！期望: ${proxyAdminOwner}, 实际: ${actualProxyAdminOwner}`
        );
    }

    // 验证部署
    const wallet = await ethers.getContractAt(
        "MultiSigWalletUpgradeable",
        proxyAddress
    );
    const walletOwners = await wallet.getOwners();
    const threshold = await wallet.getThreshold();

    console.log("\n=== Deployment Summary ===");
    console.log("Proxy Address:", proxyAddress);
    console.log("Implementation Address:", implementationAddress);
    console.log("ProxyAdmin Address:", actualProxyAdminAddress); //代理合约本身的地址，升级相关方法在这个合约里
    console.log("ProxyAdmin Owner:", proxyAdminOwner);//部署TransparentUpgradeableProxy时传入的ProxyAdmin所有者地址，用来调用ProxyAdmin Address的升级方法
    console.log("Owners:", walletOwners.length);
    console.log("Threshold:", threshold.toString());

    return {
        proxy: proxyAddress,
        implementation: implementationAddress,
        admin: actualProxyAdminAddress,
        adminOwner: proxyAdminOwner,
    };
}

main()
    .then(() => {
        console.log("\n✓ Deployment successful");
        console.log("\n⚠️  重要提示：ProxyAdmin 的所有者可以升级代理合约，请确保安全保管私钥！");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n✗ Deployment failed:");
        console.error(error);
        process.exit(1);
    });