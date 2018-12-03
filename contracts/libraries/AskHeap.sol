pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./OrderBookHeap.sol";

library AskHeap {
    using SafeMath for uint;
    using OrderBookHeap for OrderBookHeap.Tree;

    struct Asks {
        OrderBookHeap.Tree asks;
    }

    function add(Asks storage self, OrderBookHeap.Node memory n) internal {
      self.asks.add(reversePriceSign(n));
    }

    function updatePriceById(Asks storage self, uint64 id, uint newPrice) internal {
      self.asks.updatePriceById(id, newPrice);
    }

    function extractMin(Asks storage self) internal returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.pop());
    }

    function removeById(Asks storage self, uint64 id) internal returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.removeById(id));
    }

    //view
    function peakById(Asks storage self, uint64 id) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.peakById(id));
    }

    function peakByIndex(Asks storage self, uint i) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.peakByIndex(i));
    }

    function getMin(Asks storage self) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.peak());
    }

    function size(Asks storage self) internal view returns (uint) {
      return self.asks.size();
    }

    /* function getTopK(uint k) public view returns (uint[] topK) {

    } */

    //PRIVATE
    function reversePriceSign(OrderBookHeap.Node memory n) private pure returns (OrderBookHeap.Node) {
      n.price = n.price.mul(uint256(-1));
      return n;
    }
}
