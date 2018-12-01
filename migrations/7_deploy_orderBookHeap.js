var OrderBookHeap = artifacts.require("./OrderBookHeap.sol");
var TestOrderBookHeap = artifacts.require("./TestOrderBookHeap.sol");

module.exports = function(deployer) {
  deployer.deploy(OrderBookHeap);
  deployer.link(OrderBookHeap, TestOrderBookHeap);
  deployer.deploy(TestOrderBookHeap);
};
