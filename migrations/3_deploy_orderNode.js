var OrderNode = artifacts.require("./OrderNode.sol");
var TestOrderNode = artifacts.require("./TestOrderNode.sol");

module.exports = function(deployer) {
  deployer.deploy(OrderNode);
  deployer.link(OrderNode, TestOrderNode);
  deployer.deploy(TestOrderNode);
};
