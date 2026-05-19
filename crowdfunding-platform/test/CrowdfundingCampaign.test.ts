import { expect } from "chai";
import { network } from "hardhat";
import { formatEther } from "ethers";

const { ethers } = await network.connect();

// Helper function to get time helpers
async function getTime() {
    const connection = await network.connect();
    return (connection as any).networkHelpers.time;
}

// Helper function to get network helpers
async function getNetworkHelpers() {
    const connection = await network.connect();
    return (connection as any).networkHelpers;
}

// Helper function to advance time past deadline
async function advanceTimePastDeadline(deadline: bigint) {
    const currentBlock = await ethers.provider.getBlock("latest");
    const currentTimestamp = BigInt(currentBlock?.timestamp || 0);
    const timeToIncrease = deadline - currentTimestamp + BigInt(1);

    if (timeToIncrease > 0n) {
        // Use evm_increaseTime via provider.send
        await ethers.provider.send("evm_increaseTime", [timeToIncrease.toString()]);
        // Mine a block to apply the time change
        await ethers.provider.send("evm_mine", []);
    }
}

// Helper function to assert revert with message (Hardhat 3 compatible)
async function expectRevert(
    promise: Promise<any>,
    expectedMessage?: string
) {
    try {
        const result = await promise;
        // If it's a transaction, wait for it
        if (result && typeof result.wait === "function") {
            await result.wait();
        }
        expect.fail("Expected transaction to revert");
    } catch (error: any) {
        // Check if error was expected
        if (!expectedMessage) {
            // Just check that it reverted
            return;
        }

        // Extract error message from various possible formats
        const errorMessage =
            error?.reason ||
            error?.message ||
            error?.error?.message ||
            error?.data?.message ||
            String(error);

        if (!errorMessage.includes(expectedMessage)) {
            throw new Error(
                `Expected revert message "${expectedMessage}", but got: ${errorMessage}`
            );
        }
    }
}

describe("CrowdfundingCampaign", function () {
    let campaign: any;
    let owner: any;
    let contributor1: any;
    let contributor2: any;
    let contributor3: any;

    const CAMPAIGN_NAME = "测试众筹活动";
    const GOAL = ethers.parseEther("10");
    const DURATION_DAYS = 7;

    beforeEach(async function () {
        console.log("\n  [准备] 初始化测试环境...");
        [owner, contributor1, contributor2, contributor3] =
            await ethers.getSigners();

        console.log(`  [部署] 创建者: ${owner.address}`);
        console.log(`  [部署] 活动名称: ${CAMPAIGN_NAME}`);
        console.log(`  [部署] 目标金额: ${formatEther(GOAL)} ETH`);
        console.log(`  [部署] 持续时间: ${DURATION_DAYS} 天`);

        const CampaignFactory = await ethers.getContractFactory(
            "CrowdfundingCampaign"
        );
        campaign = await CampaignFactory.deploy(
            owner.address,
            CAMPAIGN_NAME,
            GOAL,
            DURATION_DAYS
        );
        await campaign.waitForDeployment();
        const campaignAddress = await campaign.getAddress();
        console.log(`  [部署] 合约地址: ${campaignAddress}`);
    });

    describe("Deployment", function () {
        it("Should deploy with correct initial state", async function () {
            console.log("    [测试] 验证部署后的初始状态");
            const state = await campaign.state();
            const contractOwner = await campaign.owner();
            const contractGoal = await campaign.goal();
            const totalRaised = await campaign.totalRaised();

            console.log(`    [状态] 当前状态: ${state} (0=准备中)`);
            console.log(`    [状态] 创建者: ${contractOwner}`);
            console.log(`    [状态] 目标金额: ${formatEther(contractGoal)} ETH`);
            console.log(`    [状态] 已筹集: ${formatEther(totalRaised)} ETH`);

            expect(state).to.equal(0); // Preparing
            expect(contractOwner).to.equal(owner.address);
            expect(contractGoal).to.equal(GOAL);
            expect(totalRaised).to.equal(0);
            console.log("    [通过] ✓ 初始状态验证成功");
        });

        it("Should set correct deadline", async function () {
            console.log("    [测试] 验证截止时间设置");
            const deadline = await campaign.deadline();
            const time = await getTime();
            const currentTime = await time.latest();
            const expectedDeadline = BigInt(currentTime) + BigInt(DURATION_DAYS) * BigInt(24 * 60 * 60);

            console.log(`    [时间] 当前时间: ${currentTime}`);
            console.log(`    [时间] 截止时间: ${deadline}`);
            console.log(`    [时间] 预期截止时间: ${expectedDeadline}`);

            // Allow 5 seconds tolerance - convert to number for comparison
            const diff = deadline > expectedDeadline
                ? Number(deadline - expectedDeadline)
                : Number(expectedDeadline - deadline);
            expect(diff).to.be.at.most(5);
            console.log("    [通过] ✓ 截止时间验证成功");
        });

        it("Should reject invalid constructor parameters", async function () {
            console.log("    [测试] 验证无效构造参数的拒绝");
            const CampaignFactory = await ethers.getContractFactory(
                "CrowdfundingCampaign"
            );

            console.log("    [验证] 测试零地址作为创建者...");
            await expectRevert(
                CampaignFactory.deploy(ethers.ZeroAddress, CAMPAIGN_NAME, GOAL, DURATION_DAYS),
                "CrowdfundingCampaign: invalid owner"
            );
            console.log("    [通过] ✓ 零地址被正确拒绝");

            console.log("    [验证] 测试空名称...");
            await expectRevert(
                CampaignFactory.deploy(owner.address, "", GOAL, DURATION_DAYS),
                "CrowdfundingCampaign: name cannot be empty"
            );
            console.log("    [通过] ✓ 空名称被正确拒绝");

            console.log("    [验证] 测试零目标金额...");
            await expectRevert(
                CampaignFactory.deploy(owner.address, CAMPAIGN_NAME, 0, DURATION_DAYS),
                "CrowdfundingCampaign: goal must be positive"
            );
            console.log("    [通过] ✓ 零目标金额被正确拒绝");

            console.log("    [验证] 测试零持续时间...");
            await expectRevert(
                CampaignFactory.deploy(owner.address, CAMPAIGN_NAME, GOAL, 0),
                "CrowdfundingCampaign: invalid duration"
            );
            console.log("    [通过] ✓ 零持续时间被正确拒绝");

            console.log("    [验证] 测试超过90天的持续时间...");
            await expectRevert(
                CampaignFactory.deploy(owner.address, CAMPAIGN_NAME, GOAL, 91),
                "CrowdfundingCampaign: invalid duration"
            );
            console.log("    [通过] ✓ 超过90天的持续时间被正确拒绝");
        });
    });

    describe("State Transitions", function () {
        it("Should transition from Preparing to Active", async function () {
            console.log("    [测试] 验证从准备中到进行中的状态转换");
            const stateBefore = await campaign.state();
            console.log(`    [状态] 转换前状态: ${stateBefore} (0=准备中)`);

            await campaign.start();
            const stateAfter = await campaign.state();
            console.log(`    [状态] 转换后状态: ${stateAfter} (1=进行中)`);

            expect(stateAfter).to.equal(1); // Active
            console.log("    [通过] ✓ 状态转换成功");
        });

        it("Should reject start() if not owner", async function () {
            console.log("    [测试] 验证非所有者无法启动活动");
            console.log(`    [验证] 尝试者: ${contributor1.address}`);
            await expectRevert(
                campaign.connect(contributor1).start(),
                "CrowdfundingCampaign: not owner"
            );
            console.log("    [通过] ✓ 非所有者启动被正确拒绝");
        });

        it("Should reject start() if not in Preparing state", async function () {
            console.log("    [测试] 验证非准备状态无法再次启动");
            await campaign.start();
            const currentState = await campaign.state();
            console.log(`    [状态] 当前状态: ${currentState} (1=进行中)`);
            await expectRevert(
                campaign.start(),
                "CrowdfundingCampaign: invalid state"
            );
            console.log("    [通过] ✓ 非准备状态的启动被正确拒绝");
        });

        it("Should transition to Success after deadline when goal reached", async function () {
            console.log("    [测试] 验证达到目标且截止后转换为成功状态");
            await campaign.start();
            console.log(`    [贡献] 贡献者: ${contributor1.address}`);
            console.log(`    [贡献] 贡献金额: ${formatEther(GOAL)} ETH`);

            await campaign.connect(contributor1).contribute({
                value: GOAL,
            });

            const deadline = await campaign.deadline();
            await advanceTimePastDeadline(deadline);

            await campaign.finalize();

            const state = await campaign.state();
            const totalRaised = await campaign.totalRaised();
            console.log(`    [状态] 当前状态: ${state} (2=成功)`);
            console.log(`    [状态] 已筹集总额: ${formatEther(totalRaised)} ETH`);

            expect(state).to.equal(2); // Success
            console.log("    [通过] ✓ 截止后根据筹集结果转换为成功状态");
        });

        it("Should transition to Failed after deadline without reaching goal", async function () {
            console.log("    [测试] 验证截止后未达目标转换为失败状态");
            // Deploy a new campaign with very short duration (1 second) for testing
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const shortCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                1 // 1 second duration
            );
            await shortCampaign.waitForDeployment();

            await shortCampaign.start();
            const contributionAmount = ethers.parseEther("5");
            console.log(`    [贡献] 贡献金额: ${formatEther(contributionAmount)} ETH`);

            await shortCampaign.connect(contributor1).contribute({
                value: contributionAmount,
            });

            // Get deadline and advance time past it
            const deadline = await shortCampaign.deadline();
            await advanceTimePastDeadline(deadline);

            // Now finalize should work - the block timestamp should be past deadline
            await shortCampaign.finalize();
            const state = await shortCampaign.state();
            console.log(`    [状态] 最终状态: ${state} (3=失败)`);

            expect(state).to.equal(3); // Failed
            console.log("    [通过] ✓ 截止后未达目标转换为失败状态");
        });

        it("Should reject finalize() before deadline", async function () {
            console.log("    [测试] 验证截止前无法完成活动");
            await campaign.start();
            const time = await getTime();
            const currentTime = await time.latest();
            const deadline = await campaign.deadline();
            console.log(`    [时间] 当前时间: ${currentTime}`);
            console.log(`    [时间] 截止时间: ${deadline}`);
            await expectRevert(
                campaign.finalize(),
                "CrowdfundingCampaign: campaign not ended"
            );
            console.log("    [通过] ✓ 截止前完成活动被正确拒绝");
        });
    });

    describe("Contributions", function () {
        beforeEach(async function () {
            console.log("    [准备] 启动活动以接受贡献...");
            await campaign.start();
        });

        it("Should record contributions correctly", async function () {
            console.log("    [测试] 验证贡献记录正确性");
            const contributionAmount = ethers.parseEther("5");
            console.log(`    [贡献] 贡献者: ${contributor1.address}`);
            console.log(`    [贡献] 贡献金额: ${formatEther(contributionAmount)} ETH`);

            await campaign.connect(contributor1).contribute({
                value: contributionAmount,
            });

            const recordedContribution = await campaign.contributions(contributor1.address);
            const totalRaised = await campaign.totalRaised();
            console.log(`    [记录] 贡献者记录: ${formatEther(recordedContribution)} ETH`);
            console.log(`    [记录] 总筹集金额: ${formatEther(totalRaised)} ETH`);

            expect(recordedContribution).to.equal(contributionAmount);
            expect(totalRaised).to.equal(contributionAmount);
            console.log("    [通过] ✓ 贡献记录正确");
        });

        it("Should allow multiple contributions from same user", async function () {
            console.log("    [测试] 验证同一用户多次贡献");
            const firstContribution = ethers.parseEther("3");
            const secondContribution = ethers.parseEther("2");
            console.log(`    [贡献] 第一次: ${formatEther(firstContribution)} ETH`);

            await campaign.connect(contributor1).contribute({
                value: firstContribution,
            });

            console.log(`    [贡献] 第二次: ${formatEther(secondContribution)} ETH`);
            await campaign.connect(contributor1).contribute({
                value: secondContribution,
            });

            const totalContribution = await campaign.contributions(contributor1.address);
            const totalRaised = await campaign.totalRaised();
            console.log(`    [记录] 总贡献: ${formatEther(totalContribution)} ETH`);
            console.log(`    [记录] 总筹集: ${formatEther(totalRaised)} ETH`);

            expect(totalContribution).to.equal(ethers.parseEther("5"));
            expect(totalRaised).to.equal(ethers.parseEther("5"));
            console.log("    [通过] ✓ 多次贡献累计正确");
        });

        it("Should track multiple contributors", async function () {
            console.log("    [测试] 验证多个贡献者追踪");
            console.log(`    [贡献] 贡献者1: ${contributor1.address} - ${formatEther(ethers.parseEther("3"))} ETH`);
            await campaign.connect(contributor1).contribute({
                value: ethers.parseEther("3"),
            });

            console.log(`    [贡献] 贡献者2: ${contributor2.address} - ${formatEther(ethers.parseEther("2"))} ETH`);
            await campaign.connect(contributor2).contribute({
                value: ethers.parseEther("2"),
            });

            const contributorCount = await campaign.getContributorCount();
            const contributors = await campaign.getContributors();
            console.log(`    [记录] 贡献者数量: ${contributorCount}`);
            console.log(`    [记录] 贡献者列表: ${contributors.join(", ")}`);

            expect(contributorCount).to.equal(2);
            expect(contributors).to.include(contributor1.address);
            expect(contributors).to.include(contributor2.address);
            console.log("    [通过] ✓ 多个贡献者追踪正确");
        });

        it("Should reject zero contributions", async function () {
            console.log("    [测试] 验证拒绝零金额贡献");
            await expectRevert(
                campaign.connect(contributor1).contribute({ value: 0 }),
                "CrowdfundingCampaign: contribution must be positive"
            );
            console.log("    [通过] ✓ 零金额贡献被正确拒绝");
        });

        it("Should reject contributions after deadline", async function () {
            console.log("    [测试] 验证截止后拒绝贡献");
            // Deploy a new campaign with very short duration (1 second) for testing
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const shortCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                1 // 1 second duration
            );
            await shortCampaign.waitForDeployment();
            await shortCampaign.start();

            // Get deadline and advance time past it
            const deadline = await shortCampaign.deadline();
            await advanceTimePastDeadline(deadline);

            await expectRevert(
                shortCampaign.connect(contributor1).contribute({
                    value: ethers.parseEther("1"),
                }),
                "CrowdfundingCampaign: expired"
            );
            console.log("    [通过] ✓ 截止后贡献被正确拒绝");
        });

        it("Should reject contributions when not Active", async function () {
            console.log("    [测试] 验证非进行中状态拒绝贡献");
            // This test is in the Contributions describe block which has beforeEach that starts the campaign
            // So we need to create a new campaign instance that is not started
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const newCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                DURATION_DAYS
            );
            await newCampaign.waitForDeployment();

            const state = await newCampaign.state();
            console.log(`    [状态] 当前状态: ${state} (0=准备中)`);
            // Don't start the campaign
            await expectRevert(
                newCampaign.connect(contributor1).contribute({
                    value: ethers.parseEther("1"),
                }),
                "CrowdfundingCampaign: invalid state"
            );
            console.log("    [通过] ✓ 非进行中状态的贡献被正确拒绝");
        });
    });

    describe("Fund Management", function () {
        it("Should allow owner to withdraw on success", async function () {
            console.log("    [测试] 验证成功后可提取资金并关闭项目");
            await campaign.start();
            console.log(`    [贡献] 贡献金额: ${formatEther(GOAL)} ETH`);
            await campaign.connect(contributor1).contribute({
                value: GOAL,
            });

            // 截止时间后统一结算为成功
            const deadline = await campaign.deadline();
            await advanceTimePastDeadline(deadline);
            await campaign.finalize();

            const ownerBalanceBefore = await ethers.provider.getBalance(
                owner.address
            );
            console.log(`    [余额] 提取前余额: ${formatEther(ownerBalanceBefore)} ETH`);

            const tx = await campaign.withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const ownerBalanceAfter = await ethers.provider.getBalance(
                owner.address
            );
            const state = await campaign.state();
            console.log(`    [余额] 提取后余额: ${formatEther(ownerBalanceAfter)} ETH`);
            console.log(`    [Gas] 消耗: ${formatEther(gasUsed)} ETH`);
            console.log(`    [状态] 当前状态: ${state} (4=已关闭)`);

            expect(ownerBalanceAfter).to.equal(
                ownerBalanceBefore + GOAL - BigInt(gasUsed)
            );
            expect(state).to.equal(4); // Closed
            console.log("    [通过] ✓ 成功后资金提取并关闭项目成功");
        });

        it("Should reject withdraw if not owner", async function () {
            console.log("    [测试] 验证非所有者无法提取资金");
            await campaign.start();
            await campaign.connect(contributor1).contribute({
                value: GOAL,
            });
            console.log(`    [验证] 尝试提取者: ${contributor1.address}`);

            await expectRevert(
                campaign.connect(contributor1).withdraw(),
                "CrowdfundingCampaign: not owner"
            );
            console.log("    [通过] ✓ 非所有者提取被正确拒绝");
        });

        it("Should reject withdraw if not successful", async function () {
            console.log("    [测试] 验证非成功状态无法提取");
            await campaign.start();
            const state = await campaign.state();
            console.log(`    [状态] 当前状态: ${state} (1=进行中)`);
            await expectRevert(
                campaign.withdraw(),
                "CrowdfundingCampaign: invalid state"
            );
            console.log("    [通过] ✓ 非成功状态的提取被正确拒绝");
        });

        it("Should allow refund on failure", async function () {
            console.log("    [测试] 验证失败后可退款");
            // Deploy a new campaign with very short duration (1 second) for testing
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const shortCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                1 // 1 second duration
            );
            await shortCampaign.waitForDeployment();

            const contributionAmount = ethers.parseEther("5");
            console.log(`    [贡献] 贡献金额: ${formatEther(contributionAmount)} ETH`);

            await shortCampaign.start();
            await shortCampaign.connect(contributor1).contribute({
                value: contributionAmount,
            });

            // Get deadline and advance time past it
            const deadline = await shortCampaign.deadline();
            await advanceTimePastDeadline(deadline);

            await shortCampaign.finalize();

            const contributorBalanceBefore = await ethers.provider.getBalance(
                contributor1.address
            );
            console.log(`    [余额] 退款前余额: ${formatEther(contributorBalanceBefore)} ETH`);

            const tx = await shortCampaign.connect(contributor1).refund();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const contributorBalanceAfter = await ethers.provider.getBalance(
                contributor1.address
            );
            console.log(`    [余额] 退款后余额: ${formatEther(contributorBalanceAfter)} ETH`);
            console.log(`    [Gas] 消耗: ${formatEther(gasUsed)} ETH`);

            expect(contributorBalanceAfter).to.equal(
                contributorBalanceBefore + contributionAmount - BigInt(gasUsed)
            );
            console.log("    [通过] ✓ 退款成功");
        });

        it("Should reject refund if no contribution", async function () {
            console.log("    [测试] 验证无贡献时无法退款");
            // Deploy a new campaign with very short duration (1 second) for testing
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const shortCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                1 // 1 second duration
            );
            await shortCampaign.waitForDeployment();
            await shortCampaign.start();

            // Get deadline and advance time past it
            const deadline = await shortCampaign.deadline();
            await advanceTimePastDeadline(deadline);

            await shortCampaign.finalize();
            const state = await shortCampaign.state();
            console.log(`    [状态] 最终状态: ${state} (3=失败)`);
            console.log(`    [验证] 尝试退款者: ${contributor1.address} (无贡献)`);

            await expectRevert(
                shortCampaign.connect(contributor1).refund(),
                "CrowdfundingCampaign: no contribution to refund"
            );
            console.log("    [通过] ✓ 无贡献的退款被正确拒绝");
        });

        it("Should prevent double refund", async function () {
            console.log("    [测试] 验证防止重复退款");
            // Deploy a new campaign with very short duration (1 second) for testing
            const CampaignFactory = await ethers.getContractFactory("CrowdfundingCampaign");
            const shortCampaign: any = await CampaignFactory.deploy(
                owner.address,
                CAMPAIGN_NAME,
                GOAL,
                1 // 1 second duration
            );
            await shortCampaign.waitForDeployment();

            const contributionAmount = ethers.parseEther("5");
            console.log(`    [贡献] 贡献金额: ${formatEther(contributionAmount)} ETH`);

            await shortCampaign.start();
            await shortCampaign.connect(contributor1).contribute({
                value: contributionAmount,
            });

            // Get deadline and advance time past it
            const deadline = await shortCampaign.deadline();
            await advanceTimePastDeadline(deadline);

            await shortCampaign.finalize();
            const state = await shortCampaign.state();
            console.log(`    [状态] 最终状态: ${state} (3=失败)`);

            console.log("    [退款] 第一次退款...");
            await shortCampaign.connect(contributor1).refund();
            console.log("    [验证] 尝试第二次退款...");

            // Try to refund again
            await expectRevert(
                shortCampaign.connect(contributor1).refund(),
                "CrowdfundingCampaign: no contribution to refund"
            );
            console.log("    [通过] ✓ 重复退款被正确拒绝");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            console.log("    [准备] 设置测试数据...");
            await campaign.start();
            await campaign.connect(contributor1).contribute({
                value: ethers.parseEther("3"),
            });
            await campaign.connect(contributor2).contribute({
                value: ethers.parseEther("2"),
            });
        });

        it("Should return correct progress", async function () {
            console.log("    [测试] 验证进度计算");
            const totalRaised = await campaign.totalRaised();
            const progress = await campaign.getProgress();
            console.log(`    [进度] 已筹集: ${formatEther(totalRaised)} ETH / ${formatEther(GOAL)} ETH`);
            console.log(`    [进度] 进度百分比: ${progress}%`);
            // 5 ETH / 10 ETH = 50%
            expect(progress).to.equal(50);
            console.log("    [通过] ✓ 进度计算正确");
        });

        it("Should return 100% when goal reached", async function () {
            console.log("    [测试] 验证达到或超过目标时进度为100%");
            console.log(`    [贡献] 额外贡献: ${formatEther(ethers.parseEther("5"))} ETH`);
            await campaign.connect(contributor3).contribute({
                value: ethers.parseEther("5"),
            });
            const totalRaised = await campaign.totalRaised();
            const progress = await campaign.getProgress();
            console.log(`    [进度] 已筹集: ${formatEther(totalRaised)} ETH / ${formatEther(GOAL)} ETH`);
            console.log(`    [进度] 进度百分比: ${progress}%`);
            expect(progress).to.equal(100);
            console.log("    [通过] ✓ 达到或超过目标时进度为100%");
        });

        it("Should return isActive correctly", async function () {
            console.log("    [测试] 验证活动状态检查");
            const isActiveBefore = await campaign.isActive();
            const stateBefore = await campaign.state();
            console.log(`    [状态] 当前状态: ${stateBefore} (1=进行中)`);
            console.log(`    [状态] 是否活跃: ${isActiveBefore}`);
            expect(isActiveBefore).to.be.true;

            console.log(`    [贡献] 贡献金额: ${formatEther(GOAL)} ETH (达到目标)`);
            await campaign.connect(contributor3).contribute({
                value: GOAL,
            });

            const deadline = await campaign.deadline();
            await advanceTimePastDeadline(deadline);
            await campaign.finalize();

            const isActiveAfter = await campaign.isActive();
            const stateAfter = await campaign.state();
            console.log(`    [状态] 当前状态: ${stateAfter} (2=成功或3=失败)`);
            console.log(`    [状态] 是否活跃: ${isActiveAfter}`);
            expect(isActiveAfter).to.be.false;
            console.log("    [通过] ✓ 活动状态检查正确");
        });
    });
});