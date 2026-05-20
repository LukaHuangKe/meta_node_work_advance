// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 导入并重新导出 OpenZeppelin 的 ProxyAdmin 合约
// 这个文件用于让 Hardhat 能够编译和部署 ProxyAdmin
import {ProxyAdmin as OpenZeppelinProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

// 重新导出以便 Hardhat 可以找到
contract ProxyAdmin is OpenZeppelinProxyAdmin {
    constructor(address initialOwner) OpenZeppelinProxyAdmin(initialOwner) {}
}