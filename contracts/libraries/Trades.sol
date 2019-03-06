pragma solidity 0.4.24;

import "./Math.sol";
import "./Arrays.sol";

library Trades {
  using Arrays for uint64[];

  /* --- STRUCTS --- */

  struct Trade {
    uint64 id;
    uint price;
    uint amount;
    bool isSell;
  }

  struct List {
    Trade[] trades;
    uint64[] timestamps;
  }

  struct GetTradesResult {
    uint64[] ids;
    uint[] prices;
    uint[] amounts;
    bool[] isSells;
    uint64[] timestamps;
  }

  /* --- PUBLIC --- */

  function add(List storage self, Trade memory n, uint64 timestamp)
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
    self.timestamps.push(timestamp);
  }

  /**
   * @dev Get trade history with in a given time range bounded by a size limit.
   * @param timeRange The unix time range to get. timeRange[0] = startTime, timeRange[1] = endTime.
   * @param limit The size limit for the get.
   */
  function getTrades(List storage self, uint64[] timeRange, uint16 limit)
    internal
    view
    returns (uint64[], uint[], uint[], bool[], uint64[])
  {
    if (timeRange[0] >= timeRange[1]) {
      return;
    }

    uint startIndex = self.timestamps.findUpperBound(timeRange[0]);
    uint endIndex = self.timestamps.findUpperBound(timeRange[1]);

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

    uint retSize = Math.min(endIndex - startIndex + 1, limit);

    GetTradesResult memory results;
    results.ids = new uint64[](retSize);
    results.prices = new uint[](retSize);
    results.amounts = new uint[](retSize);
    results.isSells = new bool[](retSize);
    results.timestamps = new uint64[](retSize);

    uint count = 0;
    while (startIndex <= endIndex) {
      if (count >= retSize) {
        break;
      }

      results.ids[count] = self.trades[endIndex].id;
      results.prices[count] = self.trades[endIndex].price;
      results.amounts[count] = self.trades[endIndex].amount;
      results.isSells[count] = self.trades[endIndex].isSell;
      results.timestamps[count] = self.timestamps[endIndex];

      endIndex--;
      count++;
    }

    return (results.ids, results.prices, results.amounts, results.isSells, results.timestamps);
  }
}
