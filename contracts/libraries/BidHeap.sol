pragma solidity ^0.4.24;

import "./OrderBookHeap.sol";
import "./OrderNode.sol";

library BidHeap {
    using OrderBookHeap for OrderBookHeap.Tree;
    using OrderNode for OrderNode.Node;

    struct Bids {
        OrderBookHeap.Tree bids;
    }

    function add(Bids storage self, OrderNode.Node memory n) internal {
      self.bids.add(n);
    }

    function updatePriceById(Bids storage self, uint64 id, uint newPrice) internal {
      self.bids.updatePriceById(id, newPrice);
    }

    function pop(Bids storage self) internal returns (OrderNode.Node) {
      return self.bids.pop();
    }

    function removeById(Bids storage self, uint64 id) internal returns (OrderNode.Node) {
      return self.bids.removeById(id);
    }

    //view
    function getById(Bids storage self, uint64 id) internal view returns (OrderNode.Node) {
      return self.bids.getById(id);
    }

    function getByIndex(Bids storage self, uint i) internal view returns (OrderNode.Node) {
      return self.bids.getByIndex(i);
    }

    function peak(Bids storage self) internal view returns (OrderNode.Node) {
      return self.bids.peak();
    }

    function size(Bids storage self) internal view returns (uint) {
      return self.bids.size();
    }

    /* function getTopK(uint k) public view returns (uint[] topK) {

    } */
}
