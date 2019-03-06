pragma solidity 0.4.24;

import "./OrderNode.sol";

library Orders {
  using OrderNode for OrderNode.Node;

  /* --- STRUCTS --- */

  struct OpenOrders {
    OrderNode.Node[] nodes;
    mapping (uint64 => uint) idToIndex;
  }

  /* --- PUBLIC --- */

  function addOpenOrder() {

  }

  function getOpenOrders() {

  }
}
