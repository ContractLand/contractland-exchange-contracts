pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract TestToken is StandardToken {
  function setBalance(uint _value) public {
      balances[msg.sender] = _value;
  }
}
