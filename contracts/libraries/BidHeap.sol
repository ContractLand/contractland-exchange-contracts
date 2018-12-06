pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./OrderNode.sol";

library BidHeap {
  using SafeMath for uint;
  using OrderNode for OrderNode.Node;

  /* --- CONSTANTS --- */

  uint256 constant ROOT_INDEX = 1;
  uint256 constant UINT256_MAX = ~uint256(0);

  /* --- STRUCTS --- */

  struct Tree{
    OrderNode.Node[] nodes;
    mapping (uint64 => uint) idToIndex;
  }

  /* --- PUBLIC --- */

  function add(Tree storage self, OrderNode.Node memory n) internal {
    if (self.nodes.length == 0) { _init(self); }
    self.nodes.length++;
    uint i = self.nodes.length - 1;
    _insert(self, n, i);
    _bubbleUp(self, i);
  }

  function updatePriceById(Tree storage self, uint64 id, uint newPrice) internal {
    uint i = self.idToIndex[id];

    if (newPrice == self.nodes[i].price) {
      return;
    }

    if (newPrice > self.nodes[i].price) {
      self.nodes[i].price = newPrice;
      _bubbleUp(self, i);
    } else {
      self.nodes[i].price = newPrice;
      _bubbleDown(self, i);
    }
  }

  function updateAmountById(Tree storage self, uint64 id, uint newAmount) internal {
    uint i = self.idToIndex[id];
    self.nodes[i].amount = newAmount;
  }
  
  function pop(Tree storage self) internal returns (OrderNode.Node) {
    if (self.nodes.length <= 1) {
      return OrderNode.Node(0,0,0,0,0,0,0);
    }

    if (self.nodes.length == 2) {
      OrderNode.Node memory node = self.nodes[ROOT_INDEX];
      delete self.idToIndex[node.id];
      self.nodes.length--;

      return node;
    }

    OrderNode.Node memory root = self.nodes[ROOT_INDEX];
    _swap(self, ROOT_INDEX, self.nodes.length - 1);
    delete self.idToIndex[root.id];
    self.nodes.length--;

    _bubbleDown(self, ROOT_INDEX);

    return root;
  }

  function removeById(Tree storage self, uint64 id) internal returns (OrderNode.Node) {
    uint i = self.idToIndex[id];
    self.nodes[i].price = UINT256_MAX;
    _bubbleUp(self, i);
    return pop(self);
  }

  function peak(Tree storage self) internal view returns(OrderNode.Node){
    return getByIndex(self, ROOT_INDEX);
  }

  function getById(Tree storage self, uint64 id) internal view returns(OrderNode.Node){
    return getByIndex(self, self.idToIndex[id]);//test that all these return the emptyNode
  }

  function getByIndex(Tree storage self, uint i) internal view returns(OrderNode.Node){
    return self.nodes.length > i ? self.nodes[i] : OrderNode.Node(0,0,0,0,0,0,0);
  }

  function size(Tree storage self) internal view returns(uint){
    return self.nodes.length > 0 ? self.nodes.length - 1 : 0;
  }

  function isValid(OrderNode.Node n) internal pure returns (bool) { return n.id > 0; }

  /* --- PRIVATE --- */

  // Initialize node at index 0 with empty node because mapping values in Solidity defaults to 0.
  // Therefore, in order to maintain proper mapping in idToIndex, we treat index 0 as invalid.
  function _init(Tree storage self) private {
    if (self.nodes.length == 0) self.nodes.push(OrderNode.Node(0,0,0,0,0,0,0));
  }

  function _insert(Tree storage self, OrderNode.Node memory n, uint i) private {
    self.nodes[i] = n;
    self.idToIndex[n.id] = i;
  }

  function _swap(Tree storage self, uint x, uint y) private {
    OrderNode.Node memory temp = self.nodes[x];
    _insert(self, self.nodes[y], x);
    _insert(self, temp, y);
  }

  function _bubbleDown(Tree storage self, uint i) private {
    uint l = _left(i);
    uint r = _right(i);
    uint largest = i;

    if (l < self.nodes.length && self.nodes[l].isGreaterThan(self.nodes[i])) {
      largest = l;
    }

    if (r < self.nodes.length && self.nodes[r].isGreaterThan(self.nodes[largest])) {
      largest = r;
    }

    if (largest != i)
    {
        _swap(self, i, largest);
        _bubbleDown(self, largest);
    }
  }

  function _bubbleUp(Tree storage self, uint i) private {
    while (i != ROOT_INDEX && self.nodes[i].isGreaterThan(self.nodes[_parent(i)]))
    {
       _swap(self, i, _parent(i));
       i = _parent(i);
    }
  }

  function _parent(uint i) private pure returns (uint) {
    return i.div(2);
  }

  function _left(uint i) private pure returns (uint) {
    return i.mul(2);
  }

  function _right(uint i) private pure returns (uint) {
    return i.mul(2).add(1);
  }
}
