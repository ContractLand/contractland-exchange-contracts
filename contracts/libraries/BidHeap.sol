pragma solidity ^0.4.24;

import "./OrderBookHeap.sol";

library BidHeap {
    using OrderBookHeap for OrderBookHeap.Tree;

    struct Bids {
        OrderBookHeap.Tree bids;
    }

    function add(Bids storage self, OrderBookHeap.Node memory n) internal {
      self.bids.add(n);
    }

    function updatePriceById(Bids storage self, uint64 id, uint newPrice) internal {
      self.bids.updatePriceById(id, newPrice);
    }

    function pop(Bids storage self) internal returns (OrderBookHeap.Node) {
      return self.bids.pop();
    }

    function removeById(Bids storage self, uint64 id) internal returns (OrderBookHeap.Node) {
      return self.bids.removeById(id);
    }

    //view
    function peakById(Bids storage self, uint64 id) internal view returns (OrderBookHeap.Node) {
      return self.bids.peakById(id);
    }

    function peakByIndex(Bids storage self, uint i) internal view returns (OrderBookHeap.Node) {
      return self.bids.peakByIndex(i);
    }

    function peak(Bids storage self) internal view returns (OrderBookHeap.Node) {
      return self.bids.peak();
    }

    function size(Bids storage self) internal view returns (uint) {
      return self.bids.size();
    }

    /* function getTopK(uint k) public view returns (uint[] topK) {

    } */
}
