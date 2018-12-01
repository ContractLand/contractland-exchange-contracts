pragma solidity ^0.4.24;

import "./OrderBookHeap.sol";

library BidHeap {
    using OrderBookHeap for OrderBookHeap.Tree;

    struct Bids {
        OrderBookHeap.Tree bids;
    }

    function init(Bids storage self) internal{
        self.bids.init();
    }

    function insert(Bids storage self, OrderBookHeap.Node memory n) internal returns (OrderBookHeap.Node) {
      return self.bids.insert(n);
    }

    function update(Bids storage self, OrderBookHeap.Node memory n) internal {
      self.bids.update(n);
    }

    function extractMax(Bids storage self) internal returns (OrderBookHeap.Node) {
      return self.bids.extractMax();
    }

    function extractById(Bids storage self, uint64 id) internal returns (OrderBookHeap.Node) {
      return self.bids.extractById(id);
    }

    //view
    function dump(Bids storage self) internal view returns (OrderBookHeap.Node[]) {
      return self.bids.dump();
    }

    function getById(Bids storage self, uint64 id) internal view returns (OrderBookHeap.Node) {
      return self.bids.getById(id);
    }

    function getByIndex(Bids storage self, uint i) internal view returns (OrderBookHeap.Node) {
      return self.bids.getByIndex(i);
    }

    function getMax(Bids storage self) internal view returns (OrderBookHeap.Node) {
      return self.bids.getMax();
    }

    function size(Bids storage self) internal view returns (uint) {
      return self.bids.size();
    }

    /* function getTopK(uint k) public view returns (uint[] topK) {

    } */
}
