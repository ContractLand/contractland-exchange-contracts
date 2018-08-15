const Exchange = artifacts.require("./Exchange.sol");

module.exports = function(deployer) {
  deployer.deploy(Exchange, {gas: 10000000});
};
