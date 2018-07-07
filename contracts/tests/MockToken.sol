pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract MockToken is StandardToken {
    function setBalance(uint _value) {
        balances[msg.sender] = _value;
    }
}
