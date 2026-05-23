// scripts/deploy.ts
import { network } from "hardhat";

async function main() {
    const connection = await network.connect();
    const { ethers } = connection;

    // 获取合约实例
    const BeggingContract = await ethers.getContractFactory("BeggingContract");
    const contract = await BeggingContract.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();

    // 调用 view 方法获取 owner 地址
    const ownerAddr = await contract.getOwnerAddr();
    console.log("BeggingContract deployed to:", address);
    console.log("Owner Address:", ownerAddr);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});