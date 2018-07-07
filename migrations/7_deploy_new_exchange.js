const NewExchange = artifacts.require("./NewExchange.sol");
const RBT = artifacts.require("./RedBlackTree.sol");

module.exports = function(deployer) {
  deployer.deploy(RBT);
  deployer.link(RBT, NewExchange);
  deployer.deploy(NewExchange, {gas: 10000000});
};
