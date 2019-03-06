pragma solidity 0.4.24;

library OpenOrder {

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
    self.orders.push(n);
    uint i = self.orders.length - 1;
    self.idToIndex[n.id] = i;
  }

  function update(Orders storage self, uint64 id, uint newAmount)
    internal
  {
    uint i = self.idToIndex[id];
    self.orders[i].amount = newAmount;
  }

  // Remove element from array by copying last element to index
  // to remove and decreasing array length
  function remove(Orders storage self, uint64 id)
    internal
  {
    uint i = self.idToIndex[id];

    // TODO: deleting non existing id will delete index 0
    /* require(i < self.orders.length); */

    self.orders[i] = self.orders[self.orders.length-1];


    delete self.orders[self.orders.length-1];
    self.orders.length--;

    // Update moved elements id in mapping
    self.idToIndex[self.orders[i].id] = i;

    // Delete removed elements id from mapping
    delete self.idToIndex[id];
  }

  function getOrders(Orders storage self)
    internal
    view
    returns (uint64[], uint[], uint[], uint[], bool[], uint64[])
  {
    GetOrdersResult memory results;
    results.ids = new uint64[](self.orders.length);
    results.prices = new uint[](self.orders.length);
    results.originalAmounts = new uint[](self.orders.length);
    results.amounts = new uint[](self.orders.length);
    results.isSells = new bool[](self.orders.length);
    results.timestamps = new uint64[](self.orders.length);

    for (uint i = 0; i < self.orders.length; i++) {
      results.ids[i] = self.orders[i].id;
      results.prices[i] = self.orders[i].price;
      results.originalAmounts[i] = self.orders[i].originalAmount;
      results.amounts[i] = self.orders[i].amount;
      results.isSells[i] = self.orders[i].isSell;
      results.timestamps[i] = self.orders[i].timestamp;
    }

    return (results.ids, results.prices, results.originalAmounts, results.amounts, results.isSells, results.timestamps);
  }
}
