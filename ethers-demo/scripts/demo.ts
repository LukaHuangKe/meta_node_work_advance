import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  // 1. 读取区块链数据
  console.log('1. 读取区块链数据...');
  const blockNumber = await provider.getBlockNumber();
  console.log('当前区块号:', blockNumber);
  
  const balance = await provider.getBalance(signer.address);
  console.log('账户余额:', ethers.formatEther(balance), 'ETH');
  
  const networkInfo = await provider.getNetwork();
  console.log('网络:', networkInfo.name, 'Chain ID:', networkInfo.chainId.toString());
  console.log('');
  
  // 2. 部署合约
  console.log('2. 部署合约...');
  const contract = await ethers.deployContract("CounterDemo");
  await contract.waitForDeployment();
  const CONTRACT_ADDRESS = await contract.getAddress();
  const deploymentBlockNumber = await provider.getBlockNumber();
  console.log('合约已部署到:', CONTRACT_ADDRESS);
  console.log('部署区块号:', deploymentBlockNumber);
  console.log('');
  
  // 3. 读取初始值
  console.log('3. 读取初始值...');
  const currentNumber = await contract.getNumber();
  console.log('当前number值:', currentNumber.toString());
  console.log('');
  
  // 4. 监听事件
  console.log('4. 设置事件监听...');
  contract.on(contract.filters.Incremented(), (user, newValue, event) => {
    console.log('Incremented事件: 用户', user, '新值', newValue.toString());
  });
  console.log('事件监听已设置\n');
  
  // 5. 发送交易
  console.log('5. 发送交易...');
  console.log('调用increment()...');
  const tx1 = await contract.increment();
  console.log('交易哈希:', tx1.hash);
  const receipt1 = await tx1.wait();
  if (receipt1) {
    console.log('交易确认，区块号:', receipt1.blockNumber);
    console.log('Gas使用:', receipt1.gasUsed.toString());
  }
  
  const numberAfterIncrement = await contract.getNumber();
  console.log('increment后的number值:', numberAfterIncrement.toString());
  console.log('');
  
  // 6. 调用setNumber
  console.log('6. 调用setNumber(100)...');
  const tx2 = await contract.setNumber(100);
  const receipt2 = await tx2.wait();
  if (receipt2) {
    console.log('交易确认，区块号:', receipt2.blockNumber);
  }
  
  const numberAfterSet = await contract.getNumber();
  console.log('setNumber后的number值:', numberAfterSet.toString());
  console.log('');
  
  // 7. 查询历史事件
  console.log('7. 查询历史事件...');
  const filter = contract.filters.Incremented();
  // 从部署区块开始查询到最新区块
  const events = await contract.queryFilter(filter, deploymentBlockNumber, "latest");
  console.log('找到', events.length, '个Incremented事件');
  events.forEach((event, index) => {
    if ('args' in event && event.args) {
      console.log(`事件 ${index + 1}:`, {
        user: event.args.user,
        newValue: event.args.newValue.toString(),
        blockNumber: event.blockNumber
      });
    }
  });
  console.log('');
  
  // 8. 签名消息
  console.log('8. 签名消息...');
  const message = 'Hello, Ethers.js!';
  const signature = await signer.signMessage(message);
  console.log('消息:', message);
  console.log('签名:', signature);
  
  const recoveredAddress = ethers.verifyMessage(message, signature);
  console.log('签名者地址:', signer.address);
  console.log('恢复的地址:', recoveredAddress);
  console.log('签名有效:', recoveredAddress.toLowerCase() === signer.address.toLowerCase());
  console.log('');
  
  // 清理
  contract.removeAllListeners();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });