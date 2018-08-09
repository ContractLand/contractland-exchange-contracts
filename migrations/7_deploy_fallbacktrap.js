const FallbackTrap = artifacts.require("./FallbackTrap.sol");

module.exports = function(deployer) {
  deployer.deploy(FallbackTrap);
};
