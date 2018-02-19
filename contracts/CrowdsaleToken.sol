pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

/**
 * @title CrowdsaleToken
 * @dev Very simple ERC20 Token that can be minted.
 * It is meant to be used in a crowdsale contract.
 */
contract CrowdsaleToken is MintableToken {

  string public name = "Sample Crowdsale Token"; 
  string public symbol = "SCT";
  uint8 public constant decimals = 18;

  function CrowdsaleToken(string _name, string _symbol) public {
  	name = _name;
  	symbol = _symbol;
  }
}