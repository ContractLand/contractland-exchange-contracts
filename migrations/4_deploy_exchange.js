var Orderbook = artifacts.require('Orderbook')
var FundStore = artifacts.require('FundStore')
var Exchange = artifacts.require('Exchange')

module.exports = function (deployer) {
  fundStoreInstance = FundStore.at(FundStore.address)
  orderbookInstance = Orderbook.at(Orderbook.address)
  deployer.deploy(Exchange, fundStoreInstance.address, orderbookInstance.address)
  .then(() => {
    exchangeInstance = Exchange.at(Exchange.address)
    fundStoreInstance.updateManager(exchangeInstance.address)
    orderbookInstance.updateManager(exchangeInstance.address)
  })
}
