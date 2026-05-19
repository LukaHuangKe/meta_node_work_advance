import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VaultSystem", (m) => {
    // 先部署Token合约
    const token = m.contract("Token");

    // 然后部署Vault合约，传入Token地址
    const vault = m.contract("Vault",
        [token],
    );

    // 可选：给部署者转账一些Token
    const deployer = m.getAccount(0);
    m.call(token, "transfer", [deployer, 1n]);

    return { token, vault };
});