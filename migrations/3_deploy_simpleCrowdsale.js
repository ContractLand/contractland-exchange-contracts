const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || "ws://localhost:8546");
const BigNumber = web3.BigNumber;

var SimpleCrowdsale = artifacts.require("SimpleCrowdsale");
var CrowdsaleToken = artifacts.require("CrowdsaleToken");

module.exports = async function (deployer, network, accounts) {
  try {
    await deployer.deploy(CrowdsaleToken, "ContractLand Token", "CLT");

    const token = await CrowdsaleToken.deployed()
    const startTime = Math.floor(new Date() / 1000);
    const endTime = parseInt(startTime) + 1*60*60*24; // plus 1 day
    const rate = new BigNumber(1)//1/1000000000000000000
    const goal = new BigNumber(web3.toWei(10, 'ether'));
    const cap = new BigNumber(web3.toWei(100, 'ether'));
    const wallet = accounts[9]

    await deployer.deploy(SimpleCrowdsale,
                          startTime,
                          endTime,
                          rate,
                          goal,
                          cap,
                          wallet,
                          token.address);
  } catch (e) {
    console.log(e)
  }
};
