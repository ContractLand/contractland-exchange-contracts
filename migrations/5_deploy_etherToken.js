var WETH = artifacts.require('./WETH.sol');

module.exports = function (deployer) {
  deployer.deploy(WETH)
}
