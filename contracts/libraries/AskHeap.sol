pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./OrderNode.sol";
import "./Math.sol";

library AskHeap {
  using SafeMath for uint;
  using OrderNode for OrderNode.Node;

  /* --- CONSTANTS --- */

  uint256 constant ROOT_INDEX = 1;
  uint256 constant UINT256_MIN = 0;

  /* --- STRUCTS --- */

  struct Tree {
    OrderNode.Node[] nodes;
    mapping (uint64 => uint) idToIndex;
  }

  struct GetOrdersResult {
    uint64[] ids;
    address[] owners;
    uint[] prices;
    uint[] originalAmounts;
    uint[] amounts;
    uint64[] timestamps;
  }

  /* --- PUBLIC --- */

  function add(Tree storage self, OrderNode.Node memory n)
    internal
  {
    if (self.nodes.length == 0) { _init(self); }
    self.nodes.length++;
    uint i = self.nodes.length - 1;
    _insert(self, n, i);
    _bubbleUp(self, i);
  }

  function updatePriceById(Tree storage self, uint64 id, uint newPrice)
    internal
  {
    uint i = self.idToIndex[id];

    if(!OrderNode.isValid(self.nodes[i]) || newPrice == self.nodes[i].price) {
      return;
    }

    if (newPrice < self.nodes[i].price) {
      self.nodes[i].price = newPrice;
      _bubbleUp(self, i);
    } else {
      self.nodes[i].price = newPrice;
      _bubbleDown(self, i);
    }
  }

  function updateAmountById(Tree storage self, uint64 id, uint newAmount)
    internal
  {
    uint i = self.idToIndex[id];
    if (OrderNode.isValid(self.nodes[i])) {
      self.nodes[i].amount = newAmount;
    }
  }

  function pop(Tree storage self)
    internal
    returns (OrderNode.Node)
  {
    if (self.nodes.length <= 1) {
      return OrderNode.Node(0,0,0,0,0,0,0,false,0);
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

  function removeById(Tree storage self, uint64 id)
    internal
    returns (OrderNode.Node)
  {
    uint i = self.idToIndex[id];
    if (OrderNode.isValid(self.nodes[i])) {
      self.nodes[i].price = UINT256_MIN;
      _bubbleUp(self, i);
      return pop(self);
    }
  }

  function peak(Tree storage self)
    internal
    view
    returns (OrderNode.Node)
  {
    return getByIndex(self, ROOT_INDEX);
  }

  function getById(Tree storage self, uint64 id)
    internal
    view
    returns (OrderNode.Node)
  {
    return getByIndex(self, self.idToIndex[id]);
  }

  function getByIndex(Tree storage self, uint i)
    internal
    view
    returns (OrderNode.Node)
  {
    return self.nodes.length > i ? self.nodes[i] : OrderNode.Node(0,0,0,0,0,0,0,false,0);
  }

  function size(Tree storage self)
    internal
    view
    returns (uint)
  {
    return self.nodes.length > 0 ? self.nodes.length - 1 : 0;
  }

  function getOrders(Tree storage self, uint16 limit)
    internal
    view
    returns (uint64[], address[], uint[], uint[], uint[], uint64[])
  {
    uint retSize = Math.min(size(self), limit);
    GetOrdersResult memory results;
    results.ids = new uint64[](retSize);
    results.owners = new address[](retSize);
    results.prices = new uint[](retSize);
    results.originalAmounts = new uint[](retSize);
    results.amounts = new uint[](retSize);
    results.timestamps = new uint64[](retSize);

    for (uint i = 0; i < retSize; i++) {
        results.ids[i] = self.nodes[ROOT_INDEX + i].id;
        results.owners[i] = self.nodes[ROOT_INDEX + i].owner;
        results.prices[i] = self.nodes[ROOT_INDEX + i].price;
        results.originalAmounts[i] = self.nodes[ROOT_INDEX + i].originalAmount;
        results.amounts[i] = self.nodes[ROOT_INDEX + i].amount;
        results.timestamps[i] = self.nodes[ROOT_INDEX + i].timestamp;
    }

    return (results.ids, results.owners, results.prices, results.originalAmounts, results.amounts, results.timestamps);
  }

  function getAggregatedOrders(Tree storage self, uint16 limit)
    internal
    view
    returns (uint[], uint[], uint)
  {
    uint retSize = Math.min(size(self), limit);
    GetOrdersResult memory results;
    results.prices = new uint[](retSize);
    results.amounts = new uint[](retSize);

    if (retSize == 0) {
        return (results.prices, results.amounts, 0);
    }

    results.prices[0] = self.nodes[ROOT_INDEX].price;
    results.amounts[0] = self.nodes[ROOT_INDEX].amount;

    uint res = 1;
    uint node = 1;
    while(node < size(self) && res < retSize) {
        if (self.nodes[ROOT_INDEX + node].price == results.prices[res - 1]) {
            results.amounts[res - 1] += self.nodes[ROOT_INDEX + node].amount;
            node++;
        } else {
            results.prices[res] = self.nodes[ROOT_INDEX + node].price;
            results.amounts[res] = self.nodes[ROOT_INDEX + node].amount;
            res++;
            node++;
        }
    }

    while(node < size(self) && self.nodes[ROOT_INDEX + node].price == results.prices[res - 1]) {
        results.amounts[res - 1] += self.nodes[ROOT_INDEX + node].amount;
        node++;
    }

    return (results.prices, results.amounts, res);
  }

  function dump(Tree storage self)
    internal
    view
    returns (OrderNode.Node[])
  {
    //note: Empty set will return `[Node(0,0,0,0)]`. uninitialized will return `[]`.
    return self.nodes;
  }

  /* --- PRIVATE --- */

  // Initialize node at index 0 with empty node because mapping values in Solidity defaults to 0.
  // Therefore, in order to maintain proper mapping in idToIndex, we treat index 0 as invalid.
  function _init(Tree storage self)
    private
  {
    if (self.nodes.length == 0) self.nodes.push(OrderNode.Node(0,0,0,0,0,0,0,false,0));
  }

  function _insert(Tree storage self, OrderNode.Node memory n, uint i)
    private
  {
    self.nodes[i] = n;
    self.idToIndex[n.id] = i;
  }

  function _swap(Tree storage self, uint x, uint y)
    private
  {
    OrderNode.Node memory temp = self.nodes[x];
    _insert(self, self.nodes[y], x);
    _insert(self, temp, y);
  }

  function _bubbleDown(Tree storage self, uint i)
    private
  {
    uint l = _left(i);
    uint r = _right(i);
    uint largest = i;

    if (l < self.nodes.length && self.nodes[l].isLessThan(self.nodes[i])) {
      largest = l;
    }

    if (r < self.nodes.length && self.nodes[r].isLessThan(self.nodes[largest])) {
      largest = r;
    }

    if (largest != i)
    {
        _swap(self, i, largest);
        _bubbleDown(self, largest);
    }
  }

  function _bubbleUp(Tree storage self, uint i)
    private
  {
    while (i != ROOT_INDEX && self.nodes[i].isLessThan(self.nodes[_parent(i)]))
    {
       _swap(self, i, _parent(i));
       i = _parent(i);
    }
  }

  function _parent(uint i)
    private
    pure
    returns (uint)
  {
    return i.div(2);
  }

  function _left(uint i)
    private
    pure
    returns (uint)
  {
    return i.mul(2);
  }

  function _right(uint i)
    private
    pure
    returns (uint)
  {
    return i.mul(2).add(1);
  }
}
