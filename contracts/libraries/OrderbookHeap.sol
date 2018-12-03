pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library OrderBookHeap {
  using SafeMath for uint;

  /* --- CONSTANTS --- */

  uint256 constant ROOT_INDEX = 1;
  uint256 constant UINT256_MAX = ~uint256(0);

  /* uint256 constant UINT256_MIN = 0; */

  /* --- STRUCTS --- */

  struct Tree{
    Node[] nodes;
    mapping (uint64 => uint) idToIndex;
  }

  struct Node{
    uint64 id;
    address owner;
    address baseToken;
    address tradeToken;
    uint price;
    uint amount;
    uint64 timestamp;
  }

  /* --- LIBRARY PUBLIC --- */

  function add(Tree storage self, Node memory n) internal {//√
    if (self.nodes.length == 0) { _init(self); }
    self.nodes.length++;
    uint i = self.nodes.length - 1;
    _insert(self, n, i);
    _bubbleUp(self, i);
  }

  // TODO: this is a temp work around
  function update(Tree storage self, Node memory n) internal {//√

  }

  function pop(Tree storage self) internal returns (Node) {
    if (self.nodes.length <= 1) {
      return Node(0,0,0,0,0,0,0);
    }

    if (self.nodes.length == 2) {
      Node memory node = self.nodes[ROOT_INDEX];
      delete self.idToIndex[node.id];
      self.nodes.length--;

      return node;
    }

    Node memory root = self.nodes[ROOT_INDEX];
    _swap(self, ROOT_INDEX, self.nodes.length - 1);
    delete self.idToIndex[root.id];
    self.nodes.length--;

    _bubbleDown(self, ROOT_INDEX);

    return root;
  }

  function removeById(Tree storage self, uint64 id) internal returns (Node) {
    uint i = self.idToIndex[id];
    self.nodes[i].price = UINT256_MAX;
    _bubbleUp(self, i);
    return pop(self);
  }

  function peakById(Tree storage self, uint64 id) internal view returns(Node){
    return peakByIndex(self, self.idToIndex[id]);//test that all these return the emptyNode
  }

  function peakByIndex(Tree storage self, uint i) internal view returns(Node){
    return self.nodes.length > i ? self.nodes[i] : Node(0,0,0,0,0,0,0);
  }

  function peak(Tree storage self) internal view returns(Node){
    return peakByIndex(self, ROOT_INDEX);
  }

  function size(Tree storage self) internal view returns(uint){
    return self.nodes.length > 0 ? self.nodes.length - 1 : 0;
  }

  function isNode(Node n) internal pure returns(bool){ return n.id > 0; }

  function getTopK(Tree storage self, uint k) public view returns (uint[] topK) {

  }

  /* --- LIBRARY PRIVATE --- */

  // Initialize node at index 0 with empty node because mapping values in Solidity defaults to 0.
  // Therefore, in order to maintain proper mapping in idToIndex, we treat index 0 as invalid.
  function _init(Tree storage self) internal {
    if (self.nodes.length == 0) self.nodes.push(Node(0,0,0,0,0,0,0));
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

  function _insert(Tree storage self, Node memory n, uint i) private {//√
    self.nodes[i] = n;
    self.idToIndex[n.id] = i;
  }

  function _swap(Tree storage self, uint x, uint y) private {
    Node memory temp = self.nodes[x];
    _insert(self, self.nodes[y], x);
    _insert(self, temp, y);
  }

  function _bubbleDown(Tree storage self, uint i) private {
    uint l = _left(i);
    uint r = _right(i);
    uint largest = i;

    if (l < self.nodes.length && self.nodes[l].price > self.nodes[i].price) {
      largest = l;
    }

    if (r < self.nodes.length && self.nodes[r].price > self.nodes[largest].price) {
      largest = r;
    }

    if (largest != i)
    {
        _swap(self, i, largest);
        _bubbleDown(self, largest);
    }
  }

  function _bubbleUp(Tree storage self, uint i) private {
    while (i != ROOT_INDEX && self.nodes[_parent(i)].price < self.nodes[i].price)
    {
       _swap(self, i, _parent(i));
       i = _parent(i);
    }
  }
}
