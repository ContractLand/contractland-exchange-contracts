pragma solidity ^0.4.24;

import "../libraries/OpenOrder.sol";

contract TestOpenOrder {
  using OpenOrder for OpenOrder.Orders;

  OpenOrder.Orders data;

  function add(uint64 id, uint price, uint originalAmount, uint amount, bool isSell, uint64 timestamp) public {
    data.add(OpenOrder.Order(id, price, originalAmount, amount, isSell, timestamp));
  }

  function update(uint64 id, uint newAmount) public {
    data.update(id, newAmount);
  }

  function remove(uint64 id) public {
    data.remove(id);
  }

  function getOrders(uint16 limit) public view returns (uint64[], uint[], uint[], uint[], bool[], uint64[]) {
    return data.getOrders(limit);
  }
}
