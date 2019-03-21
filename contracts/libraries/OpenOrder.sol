pragma solidity 0.4.24;

import "./Math.sol";

library OpenOrder {

  /* --- CONSTANTS --- */

  uint256 constant ROOT_INDEX = 1;

  /* --- STRUCTS --- */

  struct Order {
    uint64 id;
    uint price;
    uint originalAmount;
    uint amount;
    bool isSell;
    uint64 timestamp;
  }

  struct Orders {
    Order[] orders;
    mapping (uint64 => uint) idToIndex;
  }

  struct GetOrdersResult {
    uint64[] ids;
    uint[] prices;
    uint[] originalAmounts;
    uint[] amounts;
    bool[] isSells;
    uint64[] timestamps;
  }

  /* --- PUBLIC --- */

  function add(Orders storage self, Order memory n)
    internal
  {
    if (self.orders.length == 0) { _init(self); }
    self.orders.push(n);
    self.idToIndex[n.id] = self.orders.length - 1;
  }

  function update(Orders storage self, uint64 id, uint newAmount)
    internal
  {
    uint i = self.idToIndex[id];
    if (!_exist(i)) {
      return;
    }
    self.orders[i].amount = newAmount;
  }

  // Remove element from array by copying last element to index
  // to remove and decreasing array length
  function remove(Orders storage self, uint64 id)
    internal
  {
    uint i = self.idToIndex[id];

    if (!_exist(i)) {
      return;
    }

    // Replace item to remove with last item in list
    self.orders[i] = self.orders[self.orders.length - 1];

    // Update id mapping to updated index if
    // item to remove is not last item
    if (i != self.orders.length - 1) {
      self.idToIndex[self.orders[i].id] = i;
    }

    // Remove last item
    delete self.orders[self.orders.length - 1];
    self.orders.length--;
    delete self.idToIndex[id];
  }

  function size(Orders storage self)
    internal
    view
    returns (uint)
  {
    return self.orders.length > 0 ? self.orders.length - 1 : 0;
  }

  function getOrders(Orders storage self, uint16 limit)
    internal
    view
    returns (uint64[], uint[], uint[], uint[], bool[], uint64[])
  {
    uint retSize = Math.min(size(self), limit);
    GetOrdersResult memory results;
    results.ids = new uint64[](retSize);
    results.prices = new uint[](retSize);
    results.originalAmounts = new uint[](retSize);
    results.amounts = new uint[](retSize);
    results.isSells = new bool[](retSize);
    results.timestamps = new uint64[](retSize);

    for (uint i = 0; i < retSize; i++) {
      results.ids[i] = self.orders[ROOT_INDEX + i].id;
      results.prices[i] = self.orders[ROOT_INDEX + i].price;
      results.originalAmounts[i] = self.orders[ROOT_INDEX + i].originalAmount;
      results.amounts[i] = self.orders[ROOT_INDEX + i].amount;
      results.isSells[i] = self.orders[ROOT_INDEX + i].isSell;
      results.timestamps[i] = self.orders[ROOT_INDEX + i].timestamp;
    }

    return (results.ids, results.prices, results.originalAmounts, results.amounts, results.isSells, results.timestamps);
  }

  /* --- PRIVATE --- */

  // Initialize orders array at index 0 with empties because mapping values in Solidity defaults to 0.
  // Therefore, in order to maintain proper mapping in idToIndex, we treat index 0 as invalid.
  function _init(Orders storage self)
    private
  {
    if (self.orders.length == 0) {
      self.orders.push(Order(0,0,0,0,false, 0));
    }
  }

  function _exist(uint index)
    private
    pure
    returns (bool)
  {
    return index >= ROOT_INDEX;
  }
}
