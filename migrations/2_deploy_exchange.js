var Exchange = artifacts.require('./Exchange.sol');

module.exports = function (deployer) {
  const fundStore = '0x0000000000000000000000000000000000000000'
  const orderbook = '0x0000000000000000000000000000000000000000'
  deployer.deploy(Exchange, fundStore, orderbook)
}
