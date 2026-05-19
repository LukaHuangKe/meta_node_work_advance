// 导入 chai 断言库中的 expect 函数，用于编写测试断言，验证合约行为是否符合预期
import { expect } from "chai";
// 导入 hardhat 中的 network 模块，用于连接和与 Hardhat 内置的本地开发网络进行交互
import { network } from "hardhat";

// 通过 network.connect() 连接到 Hardhat 本地网络，返回一个网络实例，
// 然后使用解构语法从中获取 ethers 对象，ethers 是以太坊 JavaScript 库，
// 提供了部署合约、发送交易、查询状态等丰富的 API
const { ethers } = await network.connect();

// 使用 describe 定义一个名为 "Counter" 的测试套件，用于将 Counter 合约相关的所有测试用例组织在一起
describe("Counter", function () {
  // 第一个测试用例：验证当调用 inc() 函数时，合约是否会正确触发 Increment 事件
  it("Should emit the Increment event when calling the inc() function", async function () {
    // 使用 ethers 的 deployContract 方法部署一个新的 Counter 合约实例到本地网络，
    // 返回一个合约对象 counter，可用于后续调用合约函数
    const counter = await ethers.deployContract("Counter");

    // 调用 counter.inc() 方法（发送交易），然后使用 expect 断言：
    // 1. 该交易会触发 counter 合约的 "Increment" 事件
    // 2. 事件携带的参数为 1n（BigInt 类型，表示数值 1）
    await expect(counter.inc()).to.emit(counter, "Increment").withArgs(1n);
  });

  // 第二个测试用例：验证多次递增操作所产生的 Increment 事件的参数之和，
  // 是否与合约中最终的 x 状态变量的值一致
  it("The sum of the Increment events should match the current value", async function () {
    // 重新部署一个新的 Counter 合约实例，确保每次测试都在干净的状态下运行
    const counter = await ethers.deployContract("Counter");
    // 获取当前最新的区块号，记录为 deploymentBlockNumber，
    // 后续查询事件时将以此区块号为起始点，确保只查询部署后产生的事件
    const deploymentBlockNumber = await ethers.provider.getBlockNumber();

    // run a series of increments
    // 循环调用 incBy(i)，依次递增 i 的值（1 到 10），
    // 每次调用都会触发一个 Increment 事件，事件参数 by 为 i
    for (let i = 1; i <= 10; i++) {
      await counter.incBy(i);
    }

    // 使用 queryFilter 方法查询合约的 Increment 事件，
    // counter.filters.Increment() 生成事件过滤器，
    // 查询范围从 deploymentBlockNumber 到 "latest"（最新区块）
    const events = await counter.queryFilter(
      counter.filters.Increment(),
      deploymentBlockNumber,
      "latest",
    );

    // check that the aggregated events match the current value
    // 初始化一个 BigInt 类型的变量 total，用于累加所有事件中的 by 参数值
    let total = 0n;
    // 遍历查询到的所有 Increment 事件，将每个事件的 by 参数值累加到 total 中
    for (const event of events) {
      total += event.args.by;
    }

    // 读取合约中的 x 状态变量的当前值，断言其等于 total，
    // 即验证所有 Increment 事件的参数之和与合约存储的 x 值一致
    expect(await counter.x()).to.equal(total);
  });
});
