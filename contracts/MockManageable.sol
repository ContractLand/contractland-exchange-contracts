pragma solidity ^0.4.18;

import "./Manageable.sol";

contract MockManageable is Manageable {
  function managedFunction() view public onlyManager {}
}
