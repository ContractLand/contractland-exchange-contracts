pragma solidity ^0.4.24;

import "../libraries/OrderNode.sol";

contract TestOrderNode {
  using OrderNode for OrderNode.Node;

  OrderNode.Node a;
  OrderNode.Node b;

  function setNodeA(uint price, uint64 timestamp) public {
    a.price = price;
    a.timestamp = timestamp;
  }
  
  function setNodeB(uint price, uint64 timestamp) public {
    b.price = price;
    b.timestamp = timestamp;
  }
  
  function AGreaterThanB() public view returns (bool) {
    return a.isGreaterThan(b);
  }
  
  function ALessThanB() public view returns (bool) {
    return a.isLessThan(b);
  }
}
