// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MultiSigWallet {
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
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier txExists(uint256 txIndex) {
        require(txIndex < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 txIndex) {
        require(!transactions[txIndex].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint256 txIndex) {
        require(!isConfirmed[txIndex][msg.sender], "Transaction already confirmed");
        _;
    }

    // ============ 构造函数 ============
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        require(
            _numConfirmationsRequired > 0 && _numConfirmationsRequired <= _owners.length,
            "Invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    // ============ 所有者管理 ============
    function addOwner(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid address");
        require(!isOwner[newOwner], "Already an owner");

        isOwner[newOwner] = true;
        owners.push(newOwner);

        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) public onlyOwner {
        require(isOwner[owner], "Not an owner");
        require(
            owners.length - 1 >= numConfirmationsRequired,
            "Cannot remove owner"
        );

        isOwner[owner] = false;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        emit OwnerRemoved(owner);
    }

    function changeThreshold(uint256 newThreshold) public onlyOwner {
        require(
            newThreshold > 0 && newThreshold <= owners.length,
            "Invalid threshold"
        );

        numConfirmationsRequired = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    // ============ 提案管理 ============
    function submitTransaction(
        address to,
        uint256 value,
        bytes memory data
    ) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: to,
                value: value,
                data: data,
                executed: false,
                numConfirmations: 0
            })
        );

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
    function confirmTransaction(uint256 txIndex)
    public
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    notConfirmed(txIndex)
    {
        Transaction storage transaction = transactions[txIndex];
        isConfirmed[txIndex][msg.sender] = true;
        transaction.numConfirmations += 1;

        emit ConfirmTransaction(msg.sender, txIndex);
    }

    function revokeConfirmation(uint256 txIndex)
    public
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    {
        Transaction storage transaction = transactions[txIndex];
        require(isConfirmed[txIndex][msg.sender], "Transaction not confirmed");

        isConfirmed[txIndex][msg.sender] = false;
        transaction.numConfirmations -= 1;

        emit RevokeConfirmation(msg.sender, txIndex);
    }

    // ============ 执行交易 ============
    function executeTransaction(uint256 txIndex)
    public
    onlyOwner
    txExists(txIndex)
    notExecuted(txIndex)
    {
        Transaction storage transaction = transactions[txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Cannot execute: not enough confirmations"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "Transaction execution failed");

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

    function canExecute(uint256 txIndex) public view txExists(txIndex) returns (bool) {
        Transaction storage transaction = transactions[txIndex];
        return
                !transaction.executed &&
                transaction.numConfirmations >= numConfirmationsRequired;
    }

    // ============ 接收 ETH ============
    receive() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
        }
    }

    fallback() external payable {
        if (msg.value > 0) {
            emit Deposit(msg.sender, msg.value);
        }
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}