import { expect } from "chai";
import { network } from "hardhat";
import "@nomicfoundation/hardhat-ethers-chai-matchers";

/**
 * getLoadFixture 是一个 兼容性包装函数 ，用于在不同插件配置下都能正确获取 loadFixture 。
 * 如果你的项目配置清晰，可以直接简化为 const { loadFixture } = await network.connect();
 */
// 在 Hardhat 3.0 中，使用 @nomicfoundation/hardhat-toolbox-mocha-ethers 时
// loadFixture 应该从 network 对象获取
async function getLoadFixture() {
    const connection = await network.connect();
    // @ts-ignore - loadFixture 由插件提供
    if (!connection.loadFixture) {
        // 如果 loadFixture 不可用，尝试从 networkHelpers 获取
        // @ts-ignore
        const networkHelpers = connection.networkHelpers;
        if (networkHelpers && typeof networkHelpers.loadFixture === 'function') {
            return networkHelpers.loadFixture.bind(networkHelpers);
        }
        throw new Error('loadFixture is not available');
    }
    // @ts-ignore
    return connection.loadFixture.bind(connection);
}

describe("BeggingContract", function () {
    //定义 Fixture 函数
    async function deployBeggingFixture() {
        const connection = await network.connect();
        // @ts-ignore - ethers 属性由 @nomicfoundation/hardhat-ethers 插件添加
        const { ethers } = connection;
        const signers = await ethers.getSigners();
        const [owner1, owner2, owner3] = signers;

        const BeggingContract = await ethers.getContractFactory("BeggingContract");
        const begging = await BeggingContract.deploy();
        await begging.waitForDeployment();

        /**
         * 但如果你在 fixture 内部 调了 network.connect() （provider A），
         * 在测试体内又调了一次 network.connect() （provider B），
         * Hardhat 可能会为这两次 connect() 创建 不同的 EDR 实例/上下文 。
         * - Provider A 的链上：有合约，有交易记录
         * - Provider B 的链上：是干净的，没有那些交易
         * 
         * 因此如果下面要用ethers查询余额，那必须在这里返回ethers对象！
         */
        return { ethers, begging, owner1, owner2, owner3};
    }

    //测试套件
    describe("Deployment", function () {
        //测试用例：正确初始化
        it("Should deploy", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            console.log("BeggingContract deployed to:", begging.target);//这个target只是合约地址的字符串，只能用来打印，不要拿来使用
            console.log("Owner1:", owner1.address);
            console.log("Owner2:", owner2.address);
            console.log("Owner3:", owner3.address);
        });
    });

    describe("donate function", function () {
        //测试用例：转账0值要回滚
        it("Should revert when donate", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            const value = ethers.parseEther("1");

            await expect(
                begging.connect(owner2).donate({ value: 0n })
            ).to.be.revertedWith("donate value required");

            await expect(
                begging.connect(owner1).donate({ value: value })
            ).to.be.revertedWith("owner can't donate");
        });

        it("Should donate success", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            const value = ethers.parseEther("1");

            // owner2转账，然后查询余额
            await begging.connect(owner2).donate({ value: value });
            const donation = await begging.getDonation(owner2.address);
            expect(donation).to.equal(value);
        });
    });

    describe("receive fallback function", function () {
        it("Send ETH success", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            const value = ethers.parseEther("1");

            const beggingAddress = begging.target;
            // ETH原生的方式转账
            await owner2.sendTransaction({ to: beggingAddress, value: value });
            const donation = await begging.getDonation(owner2.address);
            expect(donation).to.equal(value);
        });
    });

    describe("withdraw function", function () {
        it("Withdraw revert", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            await expect(
                begging.connect(owner2).withdraw()
            ).to.be.revertedWithCustomError(begging, "OwnableUnauthorizedAccount");
            await expect(
                begging.connect(owner1).withdraw()
            ).to.be.revertedWith("No donaters");
        });

        it("Should withdraw success", async function () {
            const loadFixture = await getLoadFixture();
            const { ethers, begging, owner1, owner2, owner3 } = await loadFixture(deployBeggingFixture);

            const value = ethers.parseEther("1");

            // 查询下owner1的余额
            const owner1BalanceBefore = await ethers.provider.getBalance(owner1.address);
            console.log("owner1BalanceBefore:", owner1BalanceBefore);

            // owner2转账
            await begging.connect(owner2).donate({ value: value });

            // owner3转账
            await begging.connect(owner3).donate({ value: value });

            // 查询下合约的余额
            const beggingBalance = await ethers.provider.getBalance(begging.target);
            console.log("beggingBalance:", beggingBalance);
            expect(beggingBalance).to.equal(value + value);

            // owner1提现
            await begging.connect(owner1).withdraw();
            const owner1BalanceAfter = await ethers.provider.getBalance(owner1.address);
            console.log("owner1BalanceAfter:", owner1BalanceAfter);
            // 因为有GAS，所以提现后余额会小于等于提现前余额
            expect(owner1BalanceAfter).to.lt(owner1BalanceBefore + value + value);
            expect(owner1BalanceAfter).to.gt(owner1BalanceBefore);
        });
    });
});