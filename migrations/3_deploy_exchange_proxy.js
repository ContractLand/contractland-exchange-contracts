var ExchangeProxy = artifacts.require('AdminUpgradeabilityProxy');
var Exchange = artifacts.require('./Exchange.sol');

module.exports = function (deployer, network, accounts) {
  const exchangeOwner = accounts[0]
  const proxyOwner = accounts[1]
  exchangeImpl = Exchange.at(Exchange.address)

  deployer.deploy(ExchangeProxy, exchangeImpl.address, { from: proxyOwner })
  .then(() => {
    exchange = Exchange.at(ExchangeProxy.address)
    exchange.initialize({ from: exchangeOwner })
  })
}
