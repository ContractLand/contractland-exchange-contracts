pragma solidity ^0.4.24;

import "../libraries/OrderHistory.sol";

contract TestOrderHistory {
  using OrderHistory for OrderHistory.Orders;

  OrderHistory.Orders data;

  function add(uint64 id, uint price, uint originalAmount, uint amount, bool isSell, bool isActive, uint64 timestamp) public {
    data.add(OrderHistory.Order(id, price, originalAmount, amount, isSell, isActive), timestamp);
  }

  function updateAmount(uint64 id, uint newAmount) public {
    data.updateAmount(id, newAmount);
  }

  function markInactive(uint64 id) public {
    data.markInactive(id);
  }

  function getOrders(uint64[] timeRange, uint16 limit) public view returns (uint64[], uint[], uint[], uint[], bool[], bool[], uint64[]) {
    return data.getOrders(timeRange, limit);
  }
}
