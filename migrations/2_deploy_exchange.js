const Exchange = artifacts.require("./Exchange.sol");
const RBT = artifacts.require("./RedBlackTree.sol");

module.exports = function(deployer) {
  deployer.deploy(RBT);
  deployer.link(RBT, Exchange);
  deployer.deploy(Exchange, {gas: 10000000});
};
