import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BeggingContractModule", (m) => {
    const beggingContract = m.contract("BeggingContract");

    // const ownerAddr = m.call(beggingContract, "getOwnerAddr");
    // console.log("ownerAddr:", ownerAddr);
    return { beggingContract };
});
