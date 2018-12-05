pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./OrderBookHeap.sol";
import "./OrderNode.sol";

library AskHeap {
    using SafeMath for uint;
    using OrderBookHeap for OrderBookHeap.Tree;
    using OrderNode for OrderNode.Node;

    struct Asks {
        OrderBookHeap.Tree asks;
    }

    function add(Asks storage self, OrderNode.Node memory n) internal {
      self.asks.add(reversePriceSign(n));
    }

    function updatePriceById(Asks storage self, uint64 id, uint newPrice) internal {
      self.asks.updatePriceById(id, newPrice);
    }

    function extractMin(Asks storage self) internal returns (OrderNode.Node) {
      return reversePriceSign(self.asks.pop());
    }

    function removeById(Asks storage self, uint64 id) internal returns (OrderNode.Node) {
      return reversePriceSign(self.asks.removeById(id));
    }

    //view
    function getById(Asks storage self, uint64 id) internal view returns (OrderNode.Node) {
      return reversePriceSign(self.asks.getById(id));
    }

    function getByIndex(Asks storage self, uint i) internal view returns (OrderNode.Node) {
      return reversePriceSign(self.asks.getByIndex(i));
    }

    function getMin(Asks storage self) internal view returns (OrderNode.Node) {
      return reversePriceSign(self.asks.peak());
    }

    function size(Asks storage self) internal view returns (uint) {
      return self.asks.size();
    }

    /* function getTopK(uint k) public view returns (uint[] topK) {

    } */

    //PRIVATE
    function reversePriceSign(OrderNode.Node memory n) private pure returns (OrderNode.Node) {
      n.price = n.price.mul(uint256(-1));
      return n;
    }
}
