var ExchangeProxy = artifacts.require('AdminUpgradeabilityProxy');
var Exchange = artifacts.require('./Exchange.sol');

module.exports = function (deployer, network, accounts) {
  exchangeImpl = Exchange.at(Exchange.address)

  deployer.deploy(ExchangeProxy, exchangeImpl.address)
  .then(() => {
    exchange = Exchange.at(ExchangeProxy.address)
    const exchangeOwner = "0xa511B8bE04a64420b2026Cc122eD79d18D4Ec048"
    exchange.initialize(exchangeOwner)
  })
}
