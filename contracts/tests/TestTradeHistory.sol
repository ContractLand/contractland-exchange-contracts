pragma solidity ^0.4.24;

import "../libraries/TradeHistory.sol";

contract TestTradeHistory {
  using TradeHistory for TradeHistory.List;

  TradeHistory.List data;

  function add(uint64 id, uint price, uint amount, bool isSell, uint64 timestamp) public {
    data.add(TradeHistory.Trade(id, price, amount, isSell, timestamp));
  }

  function getTrades() public view returns (uint64[], uint[], uint[], bool[], uint64[]) {
    return data.getTrades();
  }
}
