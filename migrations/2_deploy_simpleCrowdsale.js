const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || "ws://localhost:8546");
const BigNumber = web3.BigNumber;

var SimpleCrowdsale = artifacts.require("SimpleCrowdsale");
var CrowdsaleToken = artifacts.require("CrowdsaleToken");

module.exports = function (deployer, network, accounts) {
  let m_tokenInstance = null;
  deployer.deploy(CrowdsaleToken, "ContractLand Token", "CLT")
  .then(() => CrowdsaleToken.deployed())
  .then((tokenInstance) => {
    m_tokenInstance = tokenInstance
    const startTime = Math.floor(new Date() / 1000);
    const endTime = parseInt(startTime) + 1*60*60*24*7; // plus 1 week
    const rate = new BigNumber(500)
    const goal = new BigNumber(web3.toWei(50, 'ether'));
    const cap = new BigNumber(web3.toWei(100, 'ether'));
    const wallet = accounts[9]

    return deployer.deploy(SimpleCrowdsale,
                          startTime,
                          endTime,
                          rate,
                          goal,
                          cap,
                          wallet,
                          tokenInstance.address);
  })
  .then(() => SimpleCrowdsale.deployed())
  .then((crowdsaleInstance) => {
    m_tokenInstance.transferOwnership(crowdsaleInstance.address);
  })
};
