var Orderbook = artifacts.require('Orderbook');

module.exports = function (deployer) {
  deployer.deploy(Orderbook)
}
