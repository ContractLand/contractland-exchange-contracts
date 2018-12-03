pragma solidity 0.4.24;

library HeapNode {
  struct Node {
    uint64 id;
    address owner;
    address baseToken;
    address tradeToken;
    uint price;
    uint amount;
    /* bool sell; */
    uint64 timestamp;
  }
}
