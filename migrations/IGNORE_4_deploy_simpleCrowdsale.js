const BigNumber = web3.BigNumber;

const duration = {
    seconds: function(val) { return val},
    minutes: function(val) { return val * this.seconds(60) },
    hours:   function(val) { return val * this.minutes(60) },
    days:    function(val) { return val * this.hours(24) },
    weeks:   function(val) { return val * this.days(7) },
    years:   function(val) { return val * this.days(365)}
};

const SimpleCrowdsale = artifacts.require("SimpleCrowdsale");
const CrowdsaleToken = artifacts.require("CrowdsaleToken");

module.exports = function (deployer, network, accounts) {
  const startTime = web3.eth.getBlock('latest').timestamp
  const endTime = startTime + duration.minutes(30)
  const rate = new BigNumber(500)
  const goal = new BigNumber(web3.toWei(50, 'ether'));
  const cap = new BigNumber(web3.toWei(100, 'ether'));
  const wallet = accounts[9]

  deployer.deploy(SimpleCrowdsale,
                        startTime,
                        endTime,
                        rate,
                        goal,
                        cap,
                        wallet,
                        CrowdsaleToken.address)
  .then(() => {
    const tokenInstance = CrowdsaleToken.at(CrowdsaleToken.address)
    tokenInstance.transferOwnership(SimpleCrowdsale.address);
  })
};
