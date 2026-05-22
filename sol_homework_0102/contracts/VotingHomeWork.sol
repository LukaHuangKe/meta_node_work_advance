// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract VotingHomeWork{

    //一个mapping来存储候选人的得票数
    mapping(address => uint256) public voteCount;
    mapping(address => bool) public isCandidate;
    //用来做重置使用
    address[] public candidates;

    event Voted(address indexed voter, address indexed candidate);
    event VotedReset(uint256 resetTime);

    // 一个vote函数，允许用户投票给某个候选人
    function vote(address _candidate) external {
        require(_candidate != address(0), "VotingHomeWork: candidate address can't be 0");

        bool isExist = isCandidate[_candidate];
        if (!isExist) {
            isCandidate[_candidate] = true;
            candidates.push(_candidate);
        }
        voteCount[_candidate]++;
        emit Voted(msg.sender, _candidate);
    }

    // 一个getVotes函数，返回某个候选人的得票数
    function getVotes(address _candidate) external view returns (uint256) {
        return voteCount[_candidate];
    }

    // 一个resetVotes函数，重置所有候选人的得票数
    function resetVotes() external {
        uint len = candidates.length;
        for(uint256 i = 0; i < len; i++){
            voteCount[candidates[i]] = 0;
        }
        emit VotedReset(block.timestamp);
    }

    /**
     * @dev 反转字符串
     * @param input 输入的字符串
     * @return 反转后的字符串
     */
    function reverseString(string calldata input) public pure returns (string memory) {
        bytes memory inputBytes = bytes(input);
        uint256 len = inputBytes.length;
        bytes memory reverseBytes = new bytes(len);

        for(uint256 i = 0; i < len; i++){
            reverseBytes[i] = inputBytes[len - 1 - i];
        }

        return string(reverseBytes);
    }

    function mergeTwoSlice(uint256[] calldata arr1, uint256[] calldata arr2) public pure returns (uint256[] memory) {
        uint256 len1 = arr1.length;
        uint256 len2 = arr2.length;
        uint256 len = len1 + len2;
        uint256[] memory merged = new uint256[](len);
        uint256 i = 0;
        uint256 j = 0;
        uint256 k = 0;
        while (i < len1 && j < len2) {
            if (arr1[i] < arr2[j]) {
                merged[k] = arr1[i];
                i++;
            } else {
                merged[k] = arr2[j];
                j++;
            }
            k++;
        }
        while (i < len1) {
            merged[k] = arr1[i];
            i++;
            k++;
        }
        while (j < len2) {
            merged[k] = arr2[j];
            j++;
            k++;
        }

        return merged;
    }

    function romanToInt(string calldata s) public pure returns(int256) {
        int256 sum = 0;
        bytes memory sBytes = bytes(s);
        uint256 len = sBytes.length;

        // 处理空字符串的情况
        if (len == 0) return 0;

        // 先获取第一个字符的值作为 preNum
        int256 preNum = getValue(sBytes[0]);

        // 关键修正：循环从 i = 1 开始
        for(uint256 i = 1; i < len; i++) {
            int256 num = getValue(sBytes[i]);
            if(preNum < num) {
                sum -= preNum; // 例如 IV: preNum=1, num=5, 减去 1
            } else {
                sum += preNum; // 例如 VI: preNum=5, num=1, 加上 5
            }
            preNum = num;
        }

        // 循环结束后，加上最后一个字符的值
        sum += preNum;
        return sum;
    }

    function getValue(bytes1 ch) public pure returns(int256) {
        if(ch == 'I') return 1;
        if(ch == 'V') return 5;
        if(ch == 'X') return 10;
        if(ch == 'L') return 50;
        if(ch == 'C') return 100;
        if(ch == 'D') return 500;
        if(ch == 'M') return 1000;
        return 0;
    }
}