pragma solidity ^0.4.24;

import "../libraries/OrderHistory.sol";

contract TestOrderHistory {
  using OrderHistory for OrderHistory.Orders;

  OrderHistory.Orders data;

  function add(uint64 id, uint price, uint originalAmount, uint amount, bool isSell, uint64 timeCancelled, uint64 timestamp) public {
    data.add(OrderHistory.Order(id, price, originalAmount, amount, isSell, timeCancelled), timestamp);
  }

  function getOrders(uint64[] timeRange, uint16 limit) public view returns (uint64[], uint[], uint[], uint[], bool[], uint64[], uint64[]) {
    return data.getOrders(timeRange, limit);
  }
}
