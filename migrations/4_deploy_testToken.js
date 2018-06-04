var TestToken = artifacts.require('./TestToken.sol');

module.exports = function (deployer) {
  deployer.deploy(TestToken, "0x5e9632D39ae9F0BFA4430fbe9B2Ac4994729152B")
}
