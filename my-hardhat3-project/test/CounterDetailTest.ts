// test/Counter.test.ts
import { expect } from "chai";
import { network } from "hardhat";

// 连接网络
const { ethers, networkHelpers } = await network.connect();

// 定义Fixture函数
async function deployCounterFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const counter = await ethers.deployContract("Counter");

    return { counter, owner, addr1, addr2 };
}

// 测试套件
describe("Counter", function () {
    // 子套件：部署测试
    describe("Deployment", function () {
        // 测试用例：初始值测试
        it("Should deploy with initial value 0", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            expect(await counter.x()).to.equal(0n);
        });

        // 测试用例：合约地址验证
        it("Should have valid address", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);
            const address = await counter.getAddress();

            expect(address).to.be.a("string");
            expect(address).to.have.length(42);
            expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
        });
    });

    // 子套件：增量功能测试
    describe("Increment", function () {
        // 测试用例：基本增量
        it("Should increment counter", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            await counter.inc();
            expect(await counter.x()).to.equal(1n);

            await counter.inc();
            expect(await counter.x()).to.equal(2n);
        });

        // 测试用例：指定增量
        it("Should increment by specific amount", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            await counter.incBy(5n);
            expect(await counter.x()).to.equal(5n);

            await counter.incBy(10n);
            expect(await counter.x()).to.equal(15n);
        });

        // 测试用例：事件触发
        it("Should emit Increment event", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            // 看清楚，是先调用了inc()方法的
            await expect(counter.inc())
                .to.emit(counter, "Increment")
                .withArgs(1n);

            await expect(counter.incBy(5n))
                .to.emit(counter, "Increment")
                .withArgs(5n);
        });

        // 测试用例：错误处理
        it("Should revert when increment is zero", async function () {
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            await expect(counter.incBy(0))
                .to.be.revertedWith("incBy: increment should be positive");
        });
    });

    // 子套件：状态隔离测试
    describe("State Isolation", function () {
        // 测试用例：测试隔离验证
        it("Should not be affected by previous test", async function () {
            // 即使前面的测试修改了状态，这里也是干净的
            const { counter } = await networkHelpers.loadFixture(deployCounterFixture);

            // 从0开始，不是从之前测试的值开始
            expect(await counter.x()).to.equal(0n);
        });
    });
});