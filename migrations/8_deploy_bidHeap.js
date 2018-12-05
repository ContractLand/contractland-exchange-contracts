var BidHeap = artifacts.require("./BidHeap.sol");
var TestBidHeap = artifacts.require("./TestBidHeap.sol");

module.exports = function(deployer) {
  deployer.deploy(BidHeap);
  deployer.link(BidHeap, TestBidHeap);
  deployer.deploy(TestBidHeap);
};
