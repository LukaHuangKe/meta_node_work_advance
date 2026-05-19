// 从 Hardhat Ignition 模块库中导入 buildModule 函数，
// 该函数用于定义一个部署模块，以声明式的方式描述合约的部署和初始化过程
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// 使用 buildModule 创建一个名为 "CounterModule" 的部署模块，
// 回调函数接收一个模块构建器对象 m，它提供了部署和交互的 API
export default buildModule("CounterModule", (m) => {
  // 通过 m.contract("Counter") 声明部署一个名为 "Counter" 的合约，
  // 返回的 counter 是一个合约引用（future），代表即将部署的合约实例
  const counter = m.contract("Counter");

  // 使用 m.call() 声明在合约部署完成后立即调用 counter 的 incBy 函数，
  // 传入参数 [5n]（BigInt 类型的 5），作为合约的初始化步骤
  m.call(counter, "incBy", [5n]);

  // 返回一个对象，暴露 counter 合约引用，
  // 这样其他模块可以引用此模块并访问部署后的合约实例
  return { counter };
});
