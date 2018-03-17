pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract TestToken is StandardToken {

  string public constant name = "TestToken";
  string public constant symbol = "TST";
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 1000000 * (10 ** uint256(decimals));

  function TestToken() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
  }
}
