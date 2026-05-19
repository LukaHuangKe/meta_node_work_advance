import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const counter = await ethers.deployContract("CounterDemo");
  
  await counter.waitForDeployment();
  const address = await counter.getAddress();
  
  console.log("Counter合约已部署到:", address);
  console.log("初始x值:", (await counter.number()).toString());
  
  return address;
}

main()
  .then((address) => {
    console.log("部署成功，合约地址:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });