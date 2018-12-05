pragma solidity ^0.4.24;

import "../libraries/OrderBookHeap.sol";
import "../libraries/OrderNode.sol";
import "../libraries/AskHeap.sol";

contract TestAskHeap {
  using AskHeap for AskHeap.Asks;

  AskHeap.Asks data;

  function add(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp) public {
    data.add(OrderNode.Node(id, owner, baseToken, tradeToken, price, amount, timestamp));
  }

  function extractMin() public returns (uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp){
    OrderNode.Node memory n = data.extractMin();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  function removeById(uint64 id) public {
    data.removeById(id);
  }

  //view
  function getMin() public returns (uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp) {
    OrderNode.Node memory n = data.getMin();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  function getById(uint64 _id) public view returns (uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp) {
    OrderNode.Node memory n = data.getById(_id);
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  function size() public view returns (uint){
    return data.size();
  }
}
