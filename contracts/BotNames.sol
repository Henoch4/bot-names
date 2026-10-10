// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BotNames is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable feeToken;
    uint256 public constant ANNUAL_FEE = 0.1 ether;
    uint256 public constant MIN_LEN = 3;
    uint256 public constant MAX_LEN = 32;

    struct Record {
        address owner;
        uint256 expires;
    }

    mapping(bytes32 => Record) public records;
    mapping(address => string) public primaryName;
    uint256 public nameCount;

    event NameRegistered(string label, address indexed owner, uint256 fee, uint256 expires);
    event NameRenewed(string label, address indexed owner, uint256 fee, uint256 expires);
    event NameTransferred(string label, address indexed from, address indexed to);
    event PrimarySet(address indexed owner, string label);

    constructor(address _feeToken) Ownable(msg.sender) {
        feeToken = IERC20(_feeToken);
    }

    function _validate(string memory label) internal pure returns (bytes32) {
        bytes memory b = bytes(label);
        require(b.length >= MIN_LEN && b.length <= MAX_LEN, "Bad length");
        bytes32 key = keccak256(b);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d;
            require(ok, "Invalid char (a-z, 0-9, -)");
        }
        require(b[0] != 0x2d, "No leading dash");
        require(b[b.length - 1] != 0x2d, "No trailing dash");
        return key;
    }

    function register(string calldata label) external {
        bytes32 key = _validate(label);
        require(records[key].owner == address(0), "Taken");
        feeToken.safeTransferFrom(msg.sender, address(this), ANNUAL_FEE);
        uint256 expires = block.timestamp + 365 days;
        records[key] = Record(msg.sender, expires);
        nameCount += 1;
        emit NameRegistered(label, msg.sender, ANNUAL_FEE, expires);
    }

    function renew(string calldata label) external {
        bytes32 key = _validate(label);
        Record storage r = records[key];
        require(r.owner == msg.sender, "Not owner");
        require(r.expires > block.timestamp, "Expired name");
        feeToken.safeTransferFrom(msg.sender, address(this), ANNUAL_FEE);
        r.expires += 365 days;
        emit NameRenewed(label, msg.sender, ANNUAL_FEE, r.expires);
    }

    function transferName(string calldata label, address to) external {
        bytes32 key = _validate(label);
        Record storage r = records[key];
        require(r.owner == msg.sender, "Not owner");
        require(to != address(0), "Zero address");
        r.owner = to;
        emit NameTransferred(label, msg.sender, to);
    }

    function setPrimary(string calldata label) external {
        bytes32 key = _validate(label);
        require(records[key].owner == msg.sender, "Not owner");
        primaryName[msg.sender] = label;
        emit PrimarySet(msg.sender, label);
    }

    function resolve(string calldata label) external view returns (address, uint256) {
        bytes32 key = keccak256(bytes(label));
        Record storage r = records[key];
        if (r.owner == address(0) || r.expires <= block.timestamp) return (address(0), 0);
        return (r.owner, r.expires);
    }

    function isAvailable(string calldata label) external view returns (bool) {
        bytes32 key = keccak256(bytes(label));
        Record storage r = records[key];
        return r.owner == address(0) || r.expires <= block.timestamp;
    }
}
