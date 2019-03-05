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

  function getTrades(List storage self)
    internal
    view
    returns (uint64[], uint[], uint[], bool[], uint64[])
  {
    uint64[] memory ids = new uint64[](self.trades.length);
    uint[] memory prices = new uint[](self.trades.length);
    uint[] memory amounts = new uint[](self.trades.length);
    bool[] memory isSells = new bool[](self.trades.length);
    uint64[] memory timestamps = new uint64[](self.trades.length);

    for (uint i = 0; i < self.trades.length; i++) {
        ids[i] = self.trades[self.trades.length - 1 - i].id;
        prices[i] = self.trades[self.trades.length - 1 - i].price;
        amounts[i] = self.trades[self.trades.length - 1 - i].amount;
        isSells[i] = self.trades[self.trades.length - 1 - i].isSell;
        timestamps[i] = self.trades[self.trades.length - 1 - i].timestamp;
    }

    return (ids, prices, amounts, isSells, timestamps);
  }
}
