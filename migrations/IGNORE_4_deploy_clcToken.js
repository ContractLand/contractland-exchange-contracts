var CLCToken = artifacts.require('./CLCToken.sol');

module.exports = function (deployer) {
  deployer.deploy(CLCToken)
}
