// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title MultiSigWalletUpgradeable
 * @dev 可升级的多签钱包合约，使用 OpenZeppelin 的 Initializable
 */
contract MultiSigWalletUpgradeable is Initializable, ContextUpgradeable {
    // ============ 事件定义 ============
    event Deposit(address indexed sender, uint256 amount);
    event SubmitTransaction(
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(uint256 indexed txIndex);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event ThresholdChanged(uint256 indexed newThreshold);

    // ============ 结构体定义 ============
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    // ============ 状态变量 ============
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // ============ 修饰符 ============
    /**
     * @dev 仅所有者修饰符
     * @notice 确保只有所有者可以调用被修饰的函数
     */
    modifier onlyOwner() {
        require(isOwner[_msgSender()], "Not an owner");
        _;
    }

    /**
     * @dev 交易存在性检查修饰符
     * @notice 确保交易索引有效，交易确实存在
     * @param txIndex 交易索引
     */
    modifier txExists(uint256 txIndex) {
        require(txIndex < transactions.length, "Transaction does not exist");
        _;
    }

    /**
     * @dev 交易未执行检查修饰符
     * @notice 确保交易尚未被执行（防止重复执行）
     * @param txIndex 交易索引
     */
    modifier notExecuted(uint256 txIndex) {
        require(!transactions[txIndex].executed, "Transaction already executed");
        _;
    }

    /**
     * @dev 未确认检查修饰符
     * @notice 确保当前所有者尚未确认过此交易（防止重复确认）
     * @param txIndex 交易索引
     */
    modifier notConfirmed(uint256 txIndex) {
        require(!isConfirmed[txIndex][_msgSender()], "Transaction already confirmed");
        _;
    }

    // ============ 初始化函数（替代构造函数）============
    /**
     * @dev 初始化函数，在代理部署时调用
     * @notice 这是可升级合约的初始化函数，替代构造函数
     * @param _owners 初始所有者列表
     * @param _numConfirmationsRequired 需要的确认数（阈值）
     *
     * 工作流程：
     * 1. 初始化上下文（ContextUpgradeable）
     * 2. 验证所有者列表不为空
     * 3. 验证确认阈值有效（大于0且不超过所有者数量）
     * 4. 遍历所有者列表，验证并添加每个所有者
     * 5. 设置确认阈值
     */
    function initialize(
        address[] memory _owners,
        uint256 _numConfirmationsRequired
    ) public initializer {
        // 初始化父合约上下文
        __Context_init();

        // 验证：至少需要一个所有者
        require(_owners.length > 0, "Owners required");

        // 验证：确认阈值必须大于0，且不能超过所有者总数
        require(
            _numConfirmationsRequired > 0 && _numConfirmationsRequired <= _owners.length,
            "Invalid number of required confirmations"
        );

        // 遍历并添加所有所有者
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            // 验证：所有者地址不能为零地址
            require(owner != address(0), "Invalid owner");

            // 验证：所有者不能重复
            require(!isOwner[owner], "Owner not unique");

            // 标记为所有者
            isOwner[owner] = true;
            // 添加到所有者列表
            owners.push(owner);
        }

        // 设置确认阈值
        numConfirmationsRequired = _numConfirmationsRequired;
    }

    // ============ 所有者管理 ============
    /**
     * @dev 添加新的所有者
     * @notice 只有现有所有者可以添加新所有者
     * @param newOwner 要添加的新所有者地址
     *
     * 验证步骤：
     * 1. 验证新所有者地址不为零地址
     * 2. 验证新所有者尚未存在
     * 3. 添加到所有者列表并发出事件
     */
    function addOwner(address newOwner) public onlyOwner {
        // 验证：地址不能为零地址
        require(newOwner != address(0), "Invalid address");
        // 验证：不能重复添加已存在的所有者
        require(!isOwner[newOwner], "Already an owner");

        // 标记为新所有者
        isOwner[newOwner] = true;
        // 添加到所有者数组
        owners.push(newOwner);

        // 发出添加所有者事件
        emit OwnerAdded(newOwner);
    }

    /**
     * @dev 移除所有者
     * @notice 只有现有所有者可以移除其他所有者
     * @param owner 要移除的所有者地址
     *
     * 验证步骤：
     * 1. 验证要移除的地址确实是所有者
     * 2. 验证移除后剩余所有者数量仍能满足确认阈值要求
     * 3. 从数组中移除（使用交换技巧提高效率）
     * 4. 发出移除事件
     */
    function removeOwner(address owner) public onlyOwner {
        // 验证：必须是现有所有者
        require(isOwner[owner], "Not an owner");
        // 验证：移除后剩余所有者数量必须 >= 确认阈值
        // 这确保移除后仍然可以执行交易
        require(
            owners.length - 1 >= numConfirmationsRequired,
            "Cannot remove owner"
        );

        // 取消所有者标记
        isOwner[owner] = false;

        // 从数组中移除：使用交换技巧（将最后一个元素移到要删除的位置，然后删除最后一个）
        // 这样可以避免移动大量元素，提高 gas 效率
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                // 将要删除的元素替换为最后一个元素
                owners[i] = owners[owners.length - 1];
                // 删除最后一个元素（即原来的最后一个元素）
                owners.pop();
                break;
            }
        }

        // 发出移除所有者事件
        emit OwnerRemoved(owner);
    }

    /**
     * @dev 修改确认阈值
     * @notice 只有所有者可以修改确认阈值
     * @param newThreshold 新的确认阈值
     *
     * 验证步骤：
     * 1. 验证新阈值大于0
     * 2. 验证新阈值不超过当前所有者总数
     * 3. 更新阈值并发出事件
     */
    function changeThreshold(uint256 newThreshold) public onlyOwner {
        // 验证：阈值必须大于0，且不能超过所有者总数
        require(
            newThreshold > 0 && newThreshold <= owners.length,
            "Invalid threshold"
        );

        // 更新确认阈值
        numConfirmationsRequired = newThreshold;
        // 发出阈值变更事件
        emit ThresholdChanged(newThreshold);
    }

    // ============ 提案管理 ============
    /**
     * @dev 提交交易提案
     * @notice 所有者可以提交新的交易提案，需要其他所有者确认后才能执行
     * @param to 目标地址（接收 ETH 或调用合约的地址）
     * @param value 要发送的 ETH 数量（单位：wei）
     * @param data 调用数据（如果是调用合约函数，需要编码函数签名和参数）
     *
     * 工作流程：
     * 1. 创建新的交易提案
     * 2. 初始状态：未执行，确认数为0
     * 3. 发出提交交易事件
     *
     * 使用场景：
     * - 纯 ETH 转账：data 设为 "0x"
     * - 调用合约：data 包含函数签名和参数的编码
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner {
        // 获取新交易的索引（当前数组长度即为新索引）
        uint256 txIndex = transactions.length;

        // 创建并添加新交易提案
        transactions.push(
            Transaction({
                to: to,                    // 目标地址
                value: value,              // ETH 数量
                data: data,                // 调用数据
                executed: false,           // 初始状态：未执行
                numConfirmations: 0         // 初始确认数：0
            })
        );

        // 发出提交交易事件，便于前端监听和显示
        emit SubmitTransaction(txIndex, to, value, data);
    }

    function getTransaction(uint256 txIndex)
    public
    view
    txExists(txIndex)
    returns (
        address to,
        uint256 value,
        bytes memory data,
        bool executed,
        uint256 numConfirmations
    )
    {
        Transaction storage transaction = transactions[txIndex];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    // ============ 确认机制 ============
    /**
     * @dev 确认交易提案
     * @notice 所有者对交易提案进行确认，当确认数达到阈值后可以执行
     * @param txIndex 交易索引
     *
     * 验证条件（通过修饰符）：
     * 1. onlyOwner: 必须是所有者
     * 2. txExists: 交易必须存在
     * 3. notExecuted: 交易必须未执行
     * 4. notConfirmed: 当前所有者必须未确认过
     *
     * 执行步骤：
     * 1. 标记当前所有者已确认
     * 2. 增加确认计数
     * 3. 发出确认事件
     */
    function confirmTransaction(uint256 txIndex)
    public
    virtual
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    notConfirmed(txIndex)
    {
        // 获取交易引用
        Transaction storage transaction = transactions[txIndex];

        // 标记当前所有者已确认此交易
        isConfirmed[txIndex][_msgSender()] = true;

        // 增加确认计数
        transaction.numConfirmations += 1;

        // 发出确认事件
        emit ConfirmTransaction(_msgSender(), txIndex);
    }

    /**
     * @dev 撤销确认
     * @notice 所有者可以撤销之前对交易提案的确认（仅在交易未执行前）
     * @param txIndex 交易索引
     *
     * 验证条件：
     * 1. onlyOwner: 必须是所有者
     * 2. txExists: 交易必须存在
     * 3. notExecuted: 交易必须未执行
     * 4. 必须已经确认过（通过 require 检查）
     *
     * 执行步骤：
     * 1. 验证当前所有者确实确认过
     * 2. 取消确认标记
     * 3. 减少确认计数
     * 4. 发出撤销确认事件
     */
    function revokeConfirmation(uint256 txIndex)
    public
    virtual
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    {
        // 获取交易引用
        Transaction storage transaction = transactions[txIndex];

        // 验证：当前所有者必须已经确认过此交易
        require(isConfirmed[txIndex][_msgSender()], "Transaction not confirmed");

        // 取消确认标记
        isConfirmed[txIndex][_msgSender()] = false;

        // 减少确认计数
        transaction.numConfirmations -= 1;

        // 发出撤销确认事件
        emit RevokeConfirmation(_msgSender(), txIndex);
    }

    // ============ 执行交易 ============
    /**
     * @dev 执行交易提案
     * @notice 当交易提案达到足够的确认数后，任何所有者都可以执行它
     * @param txIndex 交易索引
     *
     * 验证条件（通过修饰符）：
     * 1. onlyOwner: 必须是所有者
     * 2. txExists: 交易必须存在
     * 3. notExecuted: 交易必须未执行
     *
     * 执行流程：
     * 1. 验证确认数是否达到阈值
     * 2. 标记交易为已执行（防止重入攻击）
     * 3. 执行外部调用（发送 ETH 或调用合约函数）
     * 4. 验证执行结果
     * 5. 发出执行事件
     *
     * 安全特性：
     * - 使用 Checks-Effects-Interactions 模式防止重入攻击
     * - 先更新状态（executed = true），再执行外部调用
     * - 验证外部调用是否成功，失败则回滚
     */
    function executeTransaction(uint256 txIndex)
    public
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    {
        // 获取交易引用
        Transaction storage transaction = transactions[txIndex];

        // 验证：确认数必须达到或超过阈值
        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Cannot execute: not enough confirmations"
        );

        // 重要：先标记为已执行（防止重入攻击）
        // 这是 Checks-Effects-Interactions 模式中的 Effects 步骤
        transaction.executed = true;

        // 执行外部调用（Interactions 步骤）
        // 向目标地址发送 ETH 并调用函数（如果有 data）
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        // 验证：外部调用必须成功，否则回滚整个交易
        require(success, "Transaction execution failed");

        // 发出执行成功事件
        emit ExecuteTransaction(txIndex);
    }

    // ============ 辅助函数 ============
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getThreshold() public view returns (uint256) {
        return numConfirmationsRequired;
    }

    function getOwnerCount() public view returns (uint256) {
        return owners.length;
    }

    function isTransactionConfirmed(uint256 txIndex, address owner)
    public
    view
    txExists(txIndex)
    returns (bool)
    {
        return isConfirmed[txIndex][owner];
    }

    function getConfirmationCount(uint256 txIndex)
    public
    view
    txExists(txIndex)
    returns (uint256)
    {
        return transactions[txIndex].numConfirmations;
    }

    /**
     * @dev 检查交易是否可以执行
     * @notice 用于前端判断交易是否满足执行条件
     * @param txIndex 交易索引
     * @return 如果可以执行返回 true，否则返回 false
     *
     * 判断条件：
     * 1. 交易未执行
     * 2. 确认数达到或超过阈值
     */
    function canExecute(uint256 txIndex) public view txExists(txIndex) returns (bool) {
        Transaction storage transaction = transactions[txIndex];
        return
                !transaction.executed &&  // 未执行
                transaction.numConfirmations >= numConfirmationsRequired;  // 确认数足够
    }

    // ============ 接收 ETH ============
    /**
     * @dev 接收 ETH 的回退函数
     * @notice 当合约收到纯 ETH 转账时（没有 data），会触发此函数
     *
     * 使用场景：
     * - 直接向合约地址转账 ETH
     * - 使用 send() 或 transfer() 发送 ETH
     *
     * 注意：
     * - 只发出事件，不执行其他逻辑
     * - 任何人都可以向合约发送 ETH
     */
    receive() external payable {
        if (msg.value > 0) {
            // 发出存款事件，记录发送者和金额
            emit Deposit(_msgSender(), msg.value);
        }
    }

    /**
     * @dev 通用回退函数
     * @notice 当合约收到 ETH 但调用的函数不存在时，会触发此函数
     *
     * 使用场景：
     * - 向合约发送 ETH 但调用了不存在的函数
     * - 作为 receive() 的备用函数
     *
     * 注意：
     * - 只发出事件，不执行其他逻辑
     * - 任何人都可以向合约发送 ETH
     */
    fallback() external payable {
        if (msg.value > 0) {
            // 发出存款事件，记录发送者和金额
            emit Deposit(_msgSender(), msg.value);
        }
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // ============ 存储间隙（为未来升级预留）============
    /**
     * @dev 为未来升级预留存储空间
     * 在升级时添加新状态变量时，需要确保不覆盖现有存储槽
     */
    uint256[50] private __gap;
}