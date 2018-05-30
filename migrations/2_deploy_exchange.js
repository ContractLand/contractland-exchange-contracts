var Orderbook = artifacts.require('./Orderbook.sol');
var FundStore = artifacts.require('./FundStore.sol');
var Exchange = artifacts.require('./Exchange.sol');

module.exports = function (deployer) {
  deployer.deploy(FundStore)
  .then(() => {
    return FundStore.deployed()
  })
  .then((fundStoreInstance) => {
    deployer.deploy(Orderbook)
    .then(() => {
      return Orderbook.deployed()
    })
    .then((orderbookInstance) => {
      deployer.deploy(Exchange, fundStoreInstance.address, orderbookInstance.address)
      .then(() => {
        return Exchange.deployed()
      })
      .then((exchangeInstance) => {
        fundStoreInstance.updateManager(exchangeInstance.address)
        orderbookInstance.updateManager(exchangeInstance.address)
      })
    })
  })
}
