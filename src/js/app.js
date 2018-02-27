var app = new Vue({
  el: '#app',
  data: {
    web3Provider: null,
    account: '',
    contracts: {},
    crowdsaleData: {
      name: '',
      symbol: '',
      startTime: '',
      endTime: '',
      ratePerEther: 0,
      etherRaised: 0,
      etherCap: 0,
      progressPercentage: 0,
      balanceInEther: 0,
      purchaseInEther: 0,
    }
  },
  mounted: function () {
    this.init()
  },
  methods: {
    init: function () {
      this.initWeb3()
    },

    initWeb3: async function () {
      // Initialize web3 and set the provider to the testRPC.
      if (typeof web3 !== 'undefined') {
        this.web3Provider = web3.currentProvider;
        web3 = new Web3(web3.currentProvider);
      } else {
        // set the provider you want from Web3.providers
        this.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:9545');
        web3 = new Web3(this.web3Provider);
      }

      web3.eth.getAccounts((err, accounts) => {
        this.account = accounts[0];
      })

      this.initAccount()
    },

    initAccount: function () {
      web3.eth.getAccounts((err, accounts) => {
        this.account = accounts[0];
      })

      this.initContract()
    },

    initContract: async function () {
      const CrowdsaleTokenArtifact = await $.getJSON('CrowdsaleToken.json')
      const CrowdsaleToken = TruffleContract(CrowdsaleTokenArtifact);
      CrowdsaleToken.setProvider(this.web3Provider);
      this.contracts.CrowdsaleTokenInstance = await CrowdsaleToken.deployed();

      const SimpleCrowdsaleArtifact = await $.getJSON('SimpleCrowdsale.json')
      this.contracts.SimpleCrowdsale = TruffleContract(SimpleCrowdsaleArtifact);
      this.contracts.SimpleCrowdsale.setProvider(this.web3Provider);
      this.contracts.SimpleCrowdsaleInstance = await this.contracts.SimpleCrowdsale.deployed()

      this.getContractInfo()
    },

    getContractInfo: async function () {
      console.log('Getting contract info...');

      try {
        this.crowdsaleData.name = await this.contracts.CrowdsaleTokenInstance.name();
        this.crowdsaleData.symbol = await this.contracts.CrowdsaleTokenInstance.symbol();
        this.crowdsaleData.startTime = await this.contracts.SimpleCrowdsaleInstance.startTime();
        this.crowdsaleData.endTime = await this.contracts.SimpleCrowdsaleInstance.endTime();
        this.crowdsaleData.ratePerEther = parseInt(await this.contracts.SimpleCrowdsaleInstance.rate());
        const weiRaised = await this.contracts.SimpleCrowdsaleInstance.weiRaised();
        this.crowdsaleData.etherRaised = parseInt(web3.fromWei(weiRaised, 'ether'));
        const weiCap = await this.contracts.SimpleCrowdsaleInstance.cap();
        this.crowdsaleData.etherCap = parseInt(web3.fromWei(weiCap, 'ether'));
        this.crowdsaleData.progressPercentage = parseInt(this.crowdsaleData.etherRaised/this.crowdsaleData.etherCap * 100)
        const balanceInWei = await this.contracts.CrowdsaleTokenInstance.balanceOf(this.account);
        this.crowdsaleData.balanceInEther = parseInt(web3.fromWei(balanceInWei, 'ether'));
      } catch (e) {
        console.log(e);
      }
    },

    handlePurchase: async function (event) {
      const ethAmount = this.crowdsaleData.purchaseInEther
      const weiAmount = web3.toWei(ethAmount, 'ether')

      try {
        const tx = await this.contracts.SimpleCrowdsaleInstance.sendTransaction({ from: this.account, value: weiAmount })
        console.log('Purcahse made: ' + JSON.stringify(tx))
      } catch (e) {
        console.log(e)
      }

      return this.getContractInfo()
    },

    getFormattedDateTime: function (unixTimeInSeconds) {
      return moment.unix(unixTimeInSeconds).format('MMMM Do YYYY, h:mm:ss a');
    }
  }
})
