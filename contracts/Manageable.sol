pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract Manageable is Ownable {
  address public manager;

  modifier onlyManager() {
    require(manager == msg.sender);
    _;
  }

  function Manageable() public {
    manager = msg.sender;
  }

  function updateManager(address newManager) public onlyOwner {
    manager = newManager;
  }
}
