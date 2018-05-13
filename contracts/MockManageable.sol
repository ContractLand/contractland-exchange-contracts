pragma solidity ^0.4.18;

import "./Manageable.sol";

contract MockManageable is Manageable {
  function MockManageable(address manager) public Manageable(manager) {}

  function managedFunction() public onlyManager {}
}
