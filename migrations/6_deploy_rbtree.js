var RedBlackTreeLib = artifacts.require("./RedBlackTree.sol");
var TestRedBlackTree = artifacts.require("./TestRedBlackTree.sol");

module.exports = function(deployer) {
  deployer.deploy(RedBlackTreeLib);
  deployer.link(RedBlackTreeLib, TestRedBlackTree);
  deployer.deploy(TestRedBlackTree);
};
