var TestToken = artifacts.require('./TestToken.sol');

module.exports = function (deployer, network, accounts) {
  deployer.deploy(TestToken, accounts[0])
}
