const Exchange = artifacts.require("./Exchange.sol");
const AskHeap = artifacts.require("./AskHeap.sol");
const BidHeap = artifacts.require("./BidHeap.sol");

module.exports = function(deployer) {
  deployer.deploy(AskHeap);
  deployer.deploy(BidHeap);
  deployer.link(AskHeap, Exchange);
  deployer.link(BidHeap, Exchange);
  deployer.deploy(Exchange, {gas: 15000000});
};
