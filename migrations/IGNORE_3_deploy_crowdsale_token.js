const CrowdsaleToken = artifacts.require("CrowdsaleToken");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(CrowdsaleToken, "ContractLand Token", "CLT")
};
