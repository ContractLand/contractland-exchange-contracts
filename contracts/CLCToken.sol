pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";

contract CLCToken is PausableToken {

  string public constant name = "ContractLand Token";
  string public constant symbol = "CLC";
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 10000 * (10 ** uint256(decimals));

  function CLCToken() public {
    totalSupply_ = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
  }
}
