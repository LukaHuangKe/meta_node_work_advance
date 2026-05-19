import { expect } from "chai";
import { network } from "hardhat";
import { formatEther } from "ethers";

const { ethers } = await network.connect();

describe("CrowdfundingFactory", function () {
    let factory: any;
    let owner: any;
    let user1: any;
    let user2: any;

    const CAMPAIGN_NAME = "测试众筹活动";

    beforeEach(async function () {
        console.log("\n  [准备] 初始化工厂合约测试环境...");
        [owner, user1, user2] = await ethers.getSigners();
        console.log(`  [账户] Owner: ${owner.address}`);
        console.log(`  [账户] User1: ${user1.address}`);
        console.log(`  [账户] User2: ${user2.address}`);

        const Factory = await ethers.getContractFactory("CrowdfundingFactory");
        factory = await Factory.deploy();
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log(`  [部署] 工厂合约地址: ${factoryAddress}`);
    });

    describe("Deployment", function () {
        it("Should deploy with zero campaigns", async function () {
            console.log("    [测试] 验证部署后活动数量为0");
            const campaignCount = await factory.getCampaignCount();
            console.log(`    [状态] 活动数量: ${campaignCount}`);
            expect(campaignCount).to.equal(0);
            console.log("    [通过] ✓ 初始活动数量正确");
        });
    });

    describe("Campaign Creation", function () {
        it("Should create a new campaign", async function () {
            console.log("    [测试] 验证创建新活动");
            const goal = ethers.parseEther("10");
            const duration = 7;
            console.log(`    [创建] 活动名称: ${CAMPAIGN_NAME}`);
            console.log(`    [创建] 目标金额: ${formatEther(goal)} ETH`);
            console.log(`    [创建] 持续时间: ${duration} 天`);
            console.log(`    [创建] 创建者: ${owner.address}`);

            const tx = await factory.createCampaign(CAMPAIGN_NAME, goal, duration);
            const receipt = await tx.wait();

            // Check event
            const event = receipt!.logs.find(
                (log: any) =>
                    log.fragment &&
                    log.fragment.name === "CampaignCreated"
            );
            expect(event).to.not.be.undefined;
            console.log("    [事件] CampaignCreated 事件已触发");

            const campaignCount = await factory.getCampaignCount();
            console.log(`    [状态] 活动数量: ${campaignCount}`);
            expect(campaignCount).to.equal(1);
            console.log("    [通过] ✓ 活动创建成功");
        });

        it("Should return correct campaign address", async function () {
            console.log("    [测试] 验证返回正确的活动地址");
            const goal = ethers.parseEther("10");
            const duration = 7;

            const tx = await factory.createCampaign(CAMPAIGN_NAME, goal, duration);
            const receipt = await tx.wait();

            // Get campaign address from event
            const campaignAddress = await factory.campaigns(0);
            console.log(`    [地址] 活动地址: ${campaignAddress}`);
            expect(campaignAddress).to.not.equal(ethers.ZeroAddress);

            // Verify it's a valid campaign
            const campaign = await ethers.getContractAt(
                "CrowdfundingCampaign",
                campaignAddress
            );
            const campaignOwner = await campaign.owner();
            const campaignGoal = await campaign.goal();
            console.log(`    [验证] 活动创建者: ${campaignOwner}`);
            console.log(`    [验证] 活动目标: ${formatEther(campaignGoal)} ETH`);
            expect(campaignOwner).to.equal(owner.address);
            expect(campaignGoal).to.equal(goal);
            console.log("    [通过] ✓ 活动地址和参数正确");
        });

        it("Should allow multiple users to create campaigns", async function () {
            console.log("    [测试] 验证多个用户可创建活动");
            const goal = ethers.parseEther("10");
            const duration = 7;

            console.log(`    [创建] User1 创建活动: ${formatEther(goal)} ETH`);
            await factory.connect(user1).createCampaign(CAMPAIGN_NAME, goal, duration);

            console.log(`    [创建] User2 创建活动: ${formatEther(goal)} ETH`);
            await factory.connect(user2).createCampaign(CAMPAIGN_NAME, goal, duration);

            const campaignCount = await factory.getCampaignCount();
            console.log(`    [状态] 总活动数量: ${campaignCount}`);
            expect(campaignCount).to.equal(2);
            console.log("    [通过] ✓ 多个用户创建活动成功");
        });
    });

    describe("Query Functions", function () {
        beforeEach(async function () {
            console.log("    [准备] 创建测试活动数据...");
            const goal = ethers.parseEther("10");
            const duration = 7;

            console.log(`    [创建] User1 创建活动1: ${formatEther(goal)} ETH`);
            await factory.connect(user1).createCampaign(CAMPAIGN_NAME, goal, duration);

            console.log(`    [创建] User1 创建活动2: ${formatEther(goal * BigInt(2))} ETH`);
            await factory.connect(user1).createCampaign(CAMPAIGN_NAME, goal * BigInt(2), duration);

            console.log(`    [创建] User2 创建活动3: ${formatEther(goal * BigInt(3))} ETH`);
            await factory.connect(user2).createCampaign(CAMPAIGN_NAME, goal * BigInt(3), duration);
        });

        it("Should return all campaigns", async function () {
            console.log("    [测试] 验证返回所有活动");
            const campaigns = await factory.getCampaigns();
            console.log(`    [查询] 活动数量: ${campaigns.length}`);
            console.log(`    [查询] 活动1地址: ${campaigns[0]}`);
            console.log(`    [查询] 活动2地址: ${campaigns[1]}`);
            console.log(`    [查询] 活动3地址: ${campaigns[2]}`);
            expect(campaigns.length).to.equal(3);
            expect(campaigns[0]).to.not.equal(ethers.ZeroAddress);
            expect(campaigns[1]).to.not.equal(ethers.ZeroAddress);
            expect(campaigns[2]).to.not.equal(ethers.ZeroAddress);
            console.log("    [通过] ✓ 所有活动查询正确");
        });

        it("Should return user's campaigns", async function () {
            console.log("    [测试] 验证返回用户创建的活动");
            console.log(`    [查询] 查询 User1 的活动...`);
            const user1Campaigns = await factory.getUserCampaigns(user1.address);
            console.log(`    [结果] User1 活动数量: ${user1Campaigns.length}`);
            console.log(`    [结果] User1 活动地址: ${user1Campaigns.join(", ")}`);
            expect(user1Campaigns.length).to.equal(2);

            console.log(`    [查询] 查询 User2 的活动...`);
            const user2Campaigns = await factory.getUserCampaigns(user2.address);
            console.log(`    [结果] User2 活动数量: ${user2Campaigns.length}`);
            console.log(`    [结果] User2 活动地址: ${user2Campaigns.join(", ")}`);
            expect(user2Campaigns.length).to.equal(1);
            console.log("    [通过] ✓ 用户活动查询正确");
        });

        it("Should return correct campaign count", async function () {
            console.log("    [测试] 验证活动数量统计");
            const campaignCount = await factory.getCampaignCount();
            console.log(`    [统计] 活动总数: ${campaignCount}`);
            expect(campaignCount).to.equal(3);
            console.log("    [通过] ✓ 活动数量统计正确");
        });
    });
});