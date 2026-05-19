import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @title Crowdfunding Deployment Module
 * @dev Hardhat Ignition module for deploying CrowdfundingFactory
 */
export default buildModule("CrowdfundingModule", (m) => {
    // Deploy CrowdfundingFactory contract
    const factory = m.contract("CrowdfundingFactory");

    return { factory };
});