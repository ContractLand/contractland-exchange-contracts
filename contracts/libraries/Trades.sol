pragma solidity 0.4.24;

library Trades {

  /* --- STRUCTS --- */

  struct Trade {
    uint64 id;
    uint price;
    uint amount;
    bool isSell;
    uint64 timestamp;
  }

  struct List {
    Trade[] trades;
  }

  struct GetTradesResult {
    uint64[] ids;
    uint[] prices;
    uint[] amounts;
    bool[] isSells;
    uint64[] timestamps;
  }

  /* --- PUBLIC --- */

  function add(List storage self, Trade memory n)
    internal
  {
    uint numOfTrades = self.trades.length;
    if (numOfTrades != 0) {
      Trade memory lastTrade = self.trades[numOfTrades - 1];
      if (lastTrade.id == n.id && lastTrade.price == n.price) {
        self.trades[numOfTrades - 1].amount += n.amount;
        return;
      }
    }

    self.trades.push(n);
  }

  function getTrades(List storage self, uint16 limit)
    internal
    view
    returns (uint64[], uint[], uint[], bool[], uint64[])
  {
    uint retSize = self.trades.length < limit ? self.trades.length : limit;

    if (retSize == 0) {
      return;
    }

    GetTradesResult memory results;
    results.ids = new uint64[](retSize);
    results.prices = new uint[](retSize);
    results.amounts = new uint[](retSize);
    results.isSells = new bool[](retSize);
    results.timestamps = new uint64[](retSize);

    uint count = 0;
    for (uint i = self.trades.length - 1; i >= 0; i--) {
      if (count >= retSize) {
        break;
      }

      results.ids[count] = self.trades[i].id;
      results.prices[count] = self.trades[i].price;
      results.amounts[count] = self.trades[i].amount;
      results.isSells[count] = self.trades[i].isSell;
      results.timestamps[count] = self.trades[i].timestamp;

      count++;
    }

    return (results.ids, results.prices, results.amounts, results.isSells, results.timestamps);
  }
}
