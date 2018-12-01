pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./OrderBookHeap.sol";

library AskHeap {
    using SafeMath for uint;
    using OrderBookHeap for OrderBookHeap.Tree;

    struct Asks {
        OrderBookHeap.Tree asks;
    }

    function init(Asks storage self) internal{
        self.asks.init();
    }

    function insert(Asks storage self, OrderBookHeap.Node memory n) internal returns (OrderBookHeap.Node) {
      return self.asks.insert(reversePriceSign(n));
    }

    function update(Asks storage self, OrderBookHeap.Node memory n) internal {
      self.asks.update(reversePriceSign(n));
    }

    function extractMin(Asks storage self) internal returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.extractMax());
    }

    function extractById(Asks storage self, uint64 id) internal returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.extractById(id));
    }

    //view
    /* function dump(Asks storage self) internal view returns (OrderBookHeap.Node[]) {
      return self.asks.dump();
    } */

    function getById(Asks storage self, uint64 id) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.getById(id));
    }

    function getByIndex(Asks storage self, uint i) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.getByIndex(i));
    }

    function getMin(Asks storage self) internal view returns (OrderBookHeap.Node) {
      return reversePriceSign(self.asks.getMax());
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
