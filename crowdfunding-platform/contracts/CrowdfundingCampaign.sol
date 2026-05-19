// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title 众筹活动合约
 * @dev 使用状态机模式的单个众筹活动合约
 * @notice 本合约管理单个众筹活动的完整生命周期，状态流转如下：
 *         准备中(Preparing) -> 进行中(Active) -> 成功(Success)/失败(Failed) -> 已关闭(Closed)/已退款(Refunded)
 */
contract CrowdfundingCampaign {
    /// @dev 枚举类型：定义众筹活动所有可能的状态
    enum State {
        Preparing,  // 准备中：活动已创建但尚未开始
        Active,     // 进行中：活动正在接受资金贡献
        Success,    // 成功：已达到筹款目标
        Failed,     // 失败：截止时间已到但未达到目标
        Closed      // 已关闭：资金已提取（仅适用于成功的活动）
    }

    /// @dev 当前活动状态
    State public state;

    /// @dev 活动创建者地址（部署后不可变）
    address public immutable owner;

    /// @dev 活动名称（部署后不可变）
    string public name;

    /// @dev 筹款目标金额，单位为wei（部署后不可变）
    uint256 public immutable goal;

    /// @dev 活动截止时间戳（部署后不可变）
    uint256 public immutable deadline;

    /// @dev 当前已筹集的总金额
    uint256 public totalRaised;

    /// @dev 映射：从贡献者地址到其贡献金额
    mapping(address => uint256) public contributions;

    /// @dev 所有贡献者地址的数组
    address[] public contributors;

    /// @dev 事件定义
    /// @notice 状态变更事件：当活动状态发生变化时触发
    event StateChanged(State oldState, State newState);
    /// @notice 贡献事件：当有用户贡献资金时触发
    event Contribution(address indexed contributor, uint256 amount);
    /// @notice 提取事件：当创建者提取资金时触发
    event Withdrawal(address indexed owner, uint256 amount);
    /// @notice 退款事件：当贡献者申请退款时触发
    event Refund(address indexed contributor, uint256 amount);

    /// @dev 修饰符定义
    /// @notice 仅所有者修饰符：确保只有活动创建者可以调用
    modifier onlyOwner() {
        require(msg.sender == owner, "CrowdfundingCampaign: not owner");
        _;
    }

    /// @notice 状态检查修饰符：确保活动处于指定状态
    /// @param _state 要求的状态
    modifier inState(State _state) {
        require(state == _state, "CrowdfundingCampaign: invalid state");
        _;
    }

    /// @notice 未过期修饰符：确保活动尚未过期
    modifier notExpired() {
        require(block.timestamp < deadline, "CrowdfundingCampaign: expired");
        _;
    }

    /**
     * @dev 构造函数：初始化众筹活动
     * @param _owner 活动创建者的地址
     * @param _name 活动名称
     * @param _goal 筹款目标金额，单位为wei
     * @param _durationInDays 活动持续时间，单位为天（范围：1-90天）
     */
    constructor(
        address _owner,
        string memory _name,
        uint256 _goal,
        uint256 _durationInDays
    ) {
        // 验证创建者地址不能为零地址
        require(_owner != address(0), "CrowdfundingCampaign: invalid owner");
        // 验证活动名称不能为空
        require(bytes(_name).length > 0, "CrowdfundingCampaign: name cannot be empty");
        // 验证目标金额必须大于0
        require(_goal > 0, "CrowdfundingCampaign: goal must be positive");
        // 验证持续时间必须在1-90天之间
        require(
            _durationInDays > 0 && _durationInDays <= 90,
            "CrowdfundingCampaign: invalid duration"
        );

        // 设置创建者地址
        owner = _owner;
        // 设置活动名称
        name = _name;
        // 设置筹款目标
        goal = _goal;
        // 计算并设置截止时间（当前时间 + 持续天数）
        deadline = block.timestamp + (_durationInDays * 1 days);
        // 初始化状态为准备中
        state = State.Preparing;
    }

    /**
     * @dev 启动活动函数
     * @notice 只有创建者可以调用，且活动必须处于准备中状态
     * @notice 将活动状态从准备中变更为进行中
     */
    function start() external onlyOwner inState(State.Preparing) {
        // 将状态变更为进行中
        state = State.Active;
        // 触发状态变更事件
        emit StateChanged(State.Preparing, State.Active);
    }

    /**
     * @dev 贡献资金函数
     * @notice 用户可以多次贡献资金
     * @notice 只能在活动进行中且未过期时调用
     * @notice 成功或失败仅在截止后由 finalize 统一结算
     */
    function contribute() external payable inState(State.Active) notExpired {
        // 验证贡献金额必须大于0
        require(msg.value > 0, "CrowdfundingCampaign: contribution must be positive");

        // 追踪新贡献者：如果是首次贡献，将其添加到贡献者数组
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }

        // 更新贡献记录：累加该贡献者的总贡献金额
        contributions[msg.sender] += msg.value;
        // 更新总筹集金额
        totalRaised += msg.value;

        // 触发贡献事件
        emit Contribution(msg.sender, msg.value);
    }

    /**
     * @dev 完成活动函数（统一结算）
     * @notice 在截止时间后调用，根据是否达到目标确定最终状态（成功或失败）
     * @notice 只能在活动进行中状态时调用
     * @notice 一旦结算成功/失败后，将无法再次调用
     */
    function finalize() external inState(State.Active) {
        // 验证当前时间必须已经超过截止时间
        require(
            block.timestamp >= deadline,
            "CrowdfundingCampaign: campaign not ended"
        );

        // 保存旧状态用于事件
        State oldState = state;
        // 根据是否达到目标确定最终状态
        if (totalRaised >= goal) {
            // 达到目标，状态变更为成功
            state = State.Success;
        } else {
            // 未达到目标，状态变更为失败
            state = State.Failed;
        }
        // 触发状态变更事件
        emit StateChanged(oldState, state);
    }

    /**
     * @dev 提取资金函数
     * @notice 只有创建者可以调用，且活动必须处于成功状态
     * @notice 将合约中的所有资金转移到创建者地址
     */
    function withdraw() external onlyOwner inState(State.Success) {
        // 将状态变更为已关闭
        state = State.Closed;
        // 获取合约当前余额
        uint256 amount = address(this).balance;

        // 将资金转移到创建者地址
        (bool success, ) = owner.call{value: amount}("");
        // 验证转账是否成功
        require(success, "CrowdfundingCampaign: withdrawal failed");

        // 触发提取事件
        emit Withdrawal(owner, amount);
        // 触发状态变更事件
        emit StateChanged(State.Success, State.Closed);
    }

    /**
     * @dev 退款函数
     * @notice 活动失败后，贡献者可以申请退款取回自己的资金
     * @notice 只能在活动失败状态时调用
     */
    function refund() external inState(State.Failed) {
        // 获取调用者的贡献金额
        uint256 amount = contributions[msg.sender];
        // 验证贡献金额必须大于0
        require(amount > 0, "CrowdfundingCampaign: no contribution to refund");

        // 防止重入攻击：先清零贡献记录
        contributions[msg.sender] = 0;

        // 将资金退还给贡献者
        (bool success, ) = msg.sender.call{value: amount}("");
        // 验证转账是否成功
        require(success, "CrowdfundingCampaign: refund failed");

        // 触发退款事件
        emit Refund(msg.sender, amount);
    }

    /**
     * @dev 获取所有贡献者地址
     * @return 贡献者地址数组
     */
    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    /**
     * @dev 获取贡献者总数
     * @return 唯一贡献者的数量
     */
    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }

    /**
     * @dev 检查活动是否正在进行中
     * @return 如果活动处于进行中状态则返回true，否则返回false
     */
    function isActive() external view returns (bool) {
        return state == State.Active;
    }

    /**
     * @dev 获取活动进度百分比
     * @return 进度百分比（0-100）
     * @notice 如果目标为0则返回0，如果超过100则返回100
     */
    function getProgress() external view returns (uint256) {
        // 如果目标为0，返回0
        if (goal == 0) return 0;
        // 计算进度百分比：已筹集金额 * 100 / 目标金额
        uint256 progress = (totalRaised * 100) / goal;
        // 如果超过100%，则返回100
        return progress > 100 ? 100 : progress;
    }
}