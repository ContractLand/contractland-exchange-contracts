pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC827/ERC827Token.sol";

contract TestToken is ERC827Token {
  function setBalance(uint _value) {
      balances[msg.sender] = _value;
  }
}
