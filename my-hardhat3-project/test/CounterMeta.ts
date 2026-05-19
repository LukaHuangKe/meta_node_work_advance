// 导入 chai 断言库中的 expect 函数，用于编写测试断言
import { expect } from "chai";
// 导入 hardhat 中的 network 模块，用于连接以太坊网络
import { network } from "hardhat";

// 通过 network.connect() 连接 Hardhat 内置的本地网络，并解构获取 ethers 对象
const { ethers } = await network.connect();

// 定义一个名为 "Counter" 的测试套件，用于分组测试 Counter 合约的相关功能
// describe：Mocha 的全局函数，用于分组组织测试
describe("Counter", function () {
    // 测试用例：验证 increment() 函数是否正确触发了 Increment 事件
    it("Should emit the Increment event", async function () {
        // 使用 ethers 部署一个 Counter 合约实例，返回合约对象
        const counter = await ethers.deployContract("Counter");

        // 调用 increment() 方法，并断言该交易会触发 Counter 合约的 Increment 事件，
        // 且事件参数为 1n（BigInt 类型的 1）
        await expect(counter.inc())
            .to.emit(counter, "Increment")
            .withArgs(1n);
    });

    // 测试用例：验证 incBy() 函数是否能正确递增 number 的值
    it("Should increment correctly", async function () {
        // 重新部署一个新的 Counter 合约实例，确保测试环境独立
        const counter = await ethers.deployContract("Counter");

        // 调用 incBy(5) 将合约中的 number 增加 5
        await counter.incBy(5);
        // 读取合约中的 number 值，断言其等于 5n（BigInt 类型的 5）
        expect(await counter.x()).to.equal(5n);
    });
});