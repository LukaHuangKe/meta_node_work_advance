import { expect } from "chai";
import { network } from "hardhat";

// 连接网络（Hardhat 3新方式）
const { ethers, networkHelpers } = await network.connect();

// 定义Fixture函数
async function deployCounterFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const counter = await ethers.deployContract("Counter");

    return { counter, owner, addr1, addr2 };
}

// 测试套件
describe("Counter", function () {
    // 测试用例
    it("Should deploy with initial value 0", async function () {
        const { counter } = await networkHelpers.loadFixture(deployCounterFixture);//上面定义的Fixture函数

        expect(await counter.x()).to.equal(0);
    });
});