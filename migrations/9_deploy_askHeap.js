var OrderBookHeap = artifacts.require("./OrderBookHeap.sol");
var AskHeap = artifacts.require("./AskHeap.sol");
var TestAskHeap = artifacts.require("./TestAskHeap.sol");

module.exports = function(deployer) {
  deployer.deploy(OrderBookHeap);
  deployer.link(OrderBookHeap, AskHeap);
  deployer.deploy(AskHeap);
  deployer.link(AskHeap, TestAskHeap);
  deployer.deploy(TestAskHeap);
};
