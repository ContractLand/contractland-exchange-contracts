pragma solidity ^0.4.18;

import "./Manageable.sol";

contract FundStore is Manageable {
  // mapping of account address to mapping of token address to amount
  mapping(address => mapping(address => uint256)) public balances;

  function getBalance(address token, address user) view public returns (uint256) {
    return balances[user][token];
  }

  function setBalance(address token, address user, uint256 newBalance) public onlyManager {
    balances[user][token] = newBalance;
  }
}
