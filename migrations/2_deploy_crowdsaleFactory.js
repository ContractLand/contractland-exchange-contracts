const BigNumber = web3.BigNumber;

const duration = {
    seconds: function(val) { return val},
    minutes: function(val) { return val * this.seconds(60) },
    hours:   function(val) { return val * this.minutes(60) },
    days:    function(val) { return val * this.hours(24) },
    weeks:   function(val) { return val * this.days(7) },
    years:   function(val) { return val * this.days(365)}
};

var CrowdsaleFactory = artifacts.require("CrowdsaleFactory");

module.exports = function (deployer, network, accounts) {
  if(network == 'rinkeby') {
    deployer.deploy(CrowdsaleFactory)
  } else {
    deployer.deploy(CrowdsaleFactory)
    .then(() => {
      return CrowdsaleFactory.deployed()
    })
    .then((crowdsaleFactoryInstance) => {
      // IMPORTANT: The following code are for local testing purpose only
      // gas estimate is: 2937048
      try {
        const tokenName = 'ContractLand Token'
        const tokenSymbol = 'CLT'
        const openingTime = web3.eth.getBlock('latest').timestamp
        const closingTime = openingTime + duration.weeks(1)
        const rate = new BigNumber(500)
        const goal = new BigNumber(web3.toWei(10, 'ether'));
        const cap = new BigNumber(web3.toWei(100, 'ether'));
        const wallet = accounts[9]
        const payment = new BigNumber(web3.toWei(1, 'ether'));
        crowdsaleFactoryInstance.createCrowdsale.estimateGas(tokenName, tokenSymbol, openingTime, closingTime, rate, goal, cap, wallet)
        .then((gasCost) => {
          console.log('==========gasCost for creating a crowdsale is: ', gasCost)
        })

        //Create a crowdsale instance
        crowdsaleFactoryInstance.createCrowdsale(tokenName, tokenSymbol, openingTime, closingTime, rate, goal, cap, wallet, { value: payment })
        .then((tx) => {
          console.log('========transaction is: ', tx)
        })
        .catch((error) => {
          console.log('========error is: ', error)
        })
      } catch (e) {
        console.log(e)
      }
    })
  }
};
