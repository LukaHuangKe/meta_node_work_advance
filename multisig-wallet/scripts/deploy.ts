import { network } from "hardhat";

async function main() {
    const connection = await network.connect();
    // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
    const { ethers } = connection;
    const [owner1, owner2, owner3] = await ethers.getSigners();

    const owners = [owner1.address, owner2.address, owner3.address];
    const numConfirmationsRequired = 2n;

    console.log("Deploying MultiSigWallet...");
    console.log("Owners:", owners);
    console.log("Required confirmations:", numConfirmationsRequired.toString());

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const wallet = await MultiSigWallet.deploy(owners, numConfirmationsRequired);

    await wallet.waitForDeployment();
    const address = await wallet.getAddress();

    console.log("MultiSigWallet deployed to:", address);
    console.log("Owners:", await wallet.getOwners());
    console.log("Threshold:", (await wallet.getThreshold()).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });