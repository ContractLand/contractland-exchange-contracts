pragma solidity ^0.4.24;

import "../libraries/Trades.sol";

contract TestTrades {
  using Trades for Trades.List;

  Trades.List data;

  function add(uint64 id, uint price, uint amount, bool isSell, uint64 timestamp) public {
    data.add(Trades.Trade(id, price, amount, isSell, timestamp));
  }

  function getTrades(uint16 limit) public view returns (uint64[], uint[], uint[], bool[], uint64[]) {
    return data.getTrades(limit);
  }
}
