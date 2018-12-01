pragma solidity ^0.4.24;

import "../libraries/OrderBookHeap.sol";

contract TestOrderBookHeap {
  using OrderBookHeap for OrderBookHeap.Tree;

  OrderBookHeap.Tree data;

  constructor() public { data.init(); }

  function insert(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp) public {
    data.insert(OrderBookHeap.Node(id, owner, baseToken, tradeToken, price, amount, timestamp));
  }

  function extractMax() public returns(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp){
    OrderBookHeap.Node memory n = data.extractMax();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  /* function extractById(uint64 id) public returns(OrderBookHeap.Node){
    return data.extractById(id);
  } */

  //view
  /* function dump() public view returns(OrderBookHeap.Node[]){
    return data.dump();
  } */

  function getMax() public returns(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp){
    OrderBookHeap.Node memory n = data.getMax();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  /* function getById(uint64 id) public view returns(OrderBookHeap.Node){
    return data.getById(id);
  }

  function getByIndex(uint i) public view returns(OrderBookHeap.Node){
    return data.getByIndex(i);
  } */

  function size() public view returns(uint){
    return data.size();
  }
}
