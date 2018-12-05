pragma solidity 0.4.24;

library OrderNode {
  
  struct Node {
    uint64 id;
    address owner;
    address baseToken;
    address tradeToken;
    uint price;
    uint amount;
    uint64 timestamp;
  }
  
  function isGreaterThan(Node storage self, Node memory b) internal view returns (bool) {
    if (self.price > b.price) {
      return true;
    } 
    
    if (self.price < b.price) {
      return false;
    }
    
    if (self.timestamp < b.timestamp) {
      return true;
    }
    
    return false;
  }
  
  function isLessThan(Node storage self, Node memory b) internal view returns (bool) {
    if (self.price < b.price) {
      return true;
    }
    
    if (self.price > b.price) {
      return false;
    }
    
    if (self.timestamp < b.timestamp) {
      return true;
    }
    
    return false;
  }
}
