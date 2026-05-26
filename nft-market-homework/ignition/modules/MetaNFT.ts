import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
const metaNFTModule = buildModule("MetaNFTModule", (m) => {
  const metaNFT = m.contract("MetaNFT")

  return { metaNFT };
});
export default metaNFTModule;