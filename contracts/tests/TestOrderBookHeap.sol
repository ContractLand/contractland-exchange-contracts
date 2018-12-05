pragma solidity ^0.4.24;

import "../libraries/OrderBookHeap.sol";
import "../libraries/OrderNode.sol";

contract TestOrderBookHeap {
  using OrderBookHeap for OrderBookHeap.Tree;

  OrderBookHeap.Tree data;

  function add(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp) public {
    data.add(OrderNode.Node(id, owner, baseToken, tradeToken, price, amount, timestamp));
  }

  function pop() public returns(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp){
    OrderNode.Node memory n = data.pop();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  function peak() public returns(uint64 id, address owner, address baseToken, address tradeToken, uint price, uint amount, uint64 timestamp){
    OrderNode.Node memory n = data.peak();
    id = n.id;
    owner = n.owner;
    tradeToken = n.tradeToken;
    baseToken = n.baseToken;
    price = n.price;
    amount = n.amount;
    timestamp = n.timestamp;
  }

  function size() public view returns(uint){
    return data.size();
  }
}
