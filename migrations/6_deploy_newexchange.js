const NewExchange = artifacts.require("./NewExchange.sol");
const OrderBookHeap = artifacts.require("./OrderBookHeap.sol");

module.exports = function(deployer) {
  deployer.deploy(OrderBookHeap);
  deployer.link(OrderBookHeap, NewExchange);
  deployer.deploy(NewExchange, {gas: 10000000});
};
