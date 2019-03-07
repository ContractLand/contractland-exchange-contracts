pragma solidity 0.4.24;

import "./Math.sol";
import "./Arrays.sol";

library OrderHistory {
  using Arrays for uint64[];

  /* --- CONSTANTS --- */

  uint256 constant ROOT_INDEX = 1;

  /* --- STRUCTS --- */

  struct Order {
    uint64 id;
    uint price;
    uint originalAmount;
    uint amount;
    bool isSell;
    bool isActive;
  }

  struct Orders {
    Order[] orders;
    uint64[] timestamps;
    mapping (uint64 => uint) idToIndex;
  }

  struct GetOrdersResult {
    uint64[] ids;
    uint[] prices;
    uint[] originalAmounts;
    uint[] amounts;
    bool[] isSells;
    bool[] isActives;
    uint64[] timestamps;
  }

  /* --- PUBLIC --- */

  function add(Orders storage self, Order memory n, uint64 timestamp)
    internal
  {
    if (self.orders.length == 0) { _init(self); }
    self.orders.push(n);
    self.timestamps.push(timestamp);
    self.idToIndex[n.id] = self.orders.length - 1;
  }

  function updateAmount(Orders storage self, uint64 id, uint newAmount)
    internal
    returns (bool)
  {
    uint i = self.idToIndex[id];
    if (!_exist(i)) {
      return false;
    }

    self.orders[i].amount = newAmount;
    return true;
  }

  function markInactive(Orders storage self, uint64 id)
    internal
    returns (bool)
  {
    uint i = self.idToIndex[id];
    if (!_exist(i)) {
      return false;
    }

    self.orders[i].isActive = false;
    return true;
  }

  /**
   * @dev Get order history with in a given time range bounded by a size limit.
   * @param timeRange The unix time range to get. timeRange[0] = startTime, timeRange[1] = endTime.
   * @param limit The size limit for the get.
   */
  function getOrders(Orders storage self, uint64[] timeRange, uint16 limit)
    internal
    view
    returns (uint64[], uint[], uint[], uint[], bool[], bool[], uint64[])
  {
    if (timeRange[0] >= timeRange[1]) {
      return;
    }

    uint startIndex = self.timestamps.findUpperBound(timeRange[0]);
    uint endIndex = self.timestamps.findUpperBound(timeRange[1]);

    if (!_exist(startIndex)) {
      startIndex = ROOT_INDEX;
    }

    if (startIndex >= endIndex) {
      return;
    }

    // If endTime goes beyond the latest timestamp, point endIndex to last element
    if (endIndex == self.timestamps.length) {
      endIndex--;
    } else {
      // If endTime is not found in timestamp, point endIndex to lower bound
      if (self.timestamps[endIndex] != timeRange[1]) {
        endIndex--;
      }
    }

    limit = uint16(Math.min(endIndex - startIndex + 1, limit));
    GetOrdersResult memory results;
    results.ids = new uint64[](limit);
    results.prices = new uint[](limit);
    results.originalAmounts = new uint[](limit);
    results.amounts = new uint[](limit);
    results.isSells = new bool[](limit);
    results.isActives = new bool[](limit);
    results.timestamps = new uint64[](limit);

    uint count = 0;
    while (startIndex <= endIndex && count < limit) {
      results.ids[count] = self.orders[endIndex].id;
      results.prices[count] = self.orders[endIndex].price;
      results.originalAmounts[count] = self.orders[endIndex].originalAmount;
      results.amounts[count] = self.orders[endIndex].amount;
      results.isSells[count] = self.orders[endIndex].isSell;
      results.isActives[count] = self.orders[endIndex].isActive;
      results.timestamps[count] = self.timestamps[endIndex];
      endIndex--;
      count++;
    }

    return (results.ids, results.prices, results.originalAmounts, results.amounts, results.isSells, results.isActives, results.timestamps);
  }

  /* --- PRIVATE --- */

  // Initialize orders and timestamps array at index 0 with empties because mapping values in Solidity defaults to 0.
  // Therefore, in order to maintain proper mapping in idToIndex, we treat index 0 as invalid.
  function _init(Orders storage self)
    private
  {
    if (self.orders.length == 0) {
      self.orders.push(Order(0,0,0,0,false,false));
      self.timestamps.push(0);
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
