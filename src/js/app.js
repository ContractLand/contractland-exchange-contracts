let App = {
  web3Provider: null,
  account: "",
  contracts: {},

  init: function () {
    return App.initWeb3();
  },

  initWeb3: async function () {
    // Initialize web3 and set the provider to the testRPC.
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // set the provider you want from Web3.providers
      App.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:9545');
      web3 = new Web3(App.web3Provider);
    }

    web3.eth.getAccounts((err, accounts) => {
      App.account = accounts[0];
    })

    return App.initAccount();
  },

  initAccount: function () {
    web3.eth.getAccounts((err, accounts) => {
      App.account = accounts[0];
    })

    return App.initContract();
  },

  initContract: async function () {
    const CrowdsaleTokenArtifact = await $.getJSON('CrowdsaleToken.json')
    const CrowdsaleToken = TruffleContract(CrowdsaleTokenArtifact);
    CrowdsaleToken.setProvider(App.web3Provider);
    App.contracts.CrowdsaleTokenInstance = await CrowdsaleToken.deployed();

    const SimpleCrowdsaleArtifact = await $.getJSON('SimpleCrowdsale.json')
    App.contracts.SimpleCrowdsale = TruffleContract(SimpleCrowdsaleArtifact);
    App.contracts.SimpleCrowdsale.setProvider(App.web3Provider);
    App.contracts.SimpleCrowdsaleInstance = await App.contracts.SimpleCrowdsale.deployed()

    App.getContractInfo();
    return App.bindEvents();
  },

  getContractInfo: async function () {
    console.log('Getting contract info...');

    try {
      const name = await App.contracts.CrowdsaleTokenInstance.name();
      const symbol = await App.contracts.CrowdsaleTokenInstance.symbol();
      const startTime = App.getFormattedDateTime(await App.contracts.SimpleCrowdsaleInstance.startTime());
      console.log("start time: " + await App.contracts.SimpleCrowdsaleInstance.startTime())
      const endTime = App.getFormattedDateTime(await App.contracts.SimpleCrowdsaleInstance.endTime());
      console.log("end time: " + await App.contracts.SimpleCrowdsaleInstance.endTime())
      const ratePerEther = await App.contracts.SimpleCrowdsaleInstance.rate();
      console.log('rate: '+ratePerEther)
      const weiRaised = await App.contracts.SimpleCrowdsaleInstance.weiRaised();
      const etherRaised = web3.fromWei(weiRaised, 'ether');
      const weiCap = await App.contracts.SimpleCrowdsaleInstance.cap();
      const etherCap = web3.fromWei(weiCap, 'ether');
      const progressPercentage = etherRaised/etherCap * 100
      console.log(progressPercentage)
      const balanceInWei = await App.contracts.CrowdsaleTokenInstance.balanceOf(App.account);
      const balanceInEther = web3.fromWei(balanceInWei, 'ether');

      $('#TokenName').text(name);
      $('#TokenSymbol').text(symbol);
      $('#StartTime').text(startTime);
      $('#EndTime').text(endTime);
      $("#AlreadyRaised").text('Already raised: '+etherRaised+'/'+etherCap+' ETH');
      $("#TokenSaleProgress").attr("aria-valuenow", progressPercentage);
      $("#TokenSaleProgress").text(progressPercentage+'%');
      $('#TokenSaleProgress').css('width', progressPercentage+'%');
      $('#Rate').text(ratePerEther.toString());
      $('#RateTokenSymbol').text(symbol);
      $('#EtherRaised').text(etherRaised);
      $('#Balance').text(balanceInEther);
    } catch (e) {
      console.log(e);
    }
  },

  bindEvents: function () {
    $(document).on('click', '#PurchaseButton', App.handlePurchase);
  },

  handlePurchase: async function (event) {
    event.preventDefault()

    const ethAmount = parseInt($('#PurchaseAmount').val())
    const weiAmount = web3.toWei(ethAmount, 'ether')

    try {
      const tx = await App.contracts.SimpleCrowdsaleInstance.sendTransaction({ from: App.account, value: weiAmount })
      // const tx = await App.contracts.SimpleCrowdsaleInstance.buyTokens(App.account, { value: weiAmount, from: App.account })
      console.log('Purcahse made: ' + JSON.stringify(tx))
    } catch (e) {
      console.log(e)
    }

    return App.getContractInfo()
  },

  getFormattedDateTime(unixTimeInSeconds) {
    return moment.unix(unixTimeInSeconds).format('MMMM Do YYYY, h:mm:ss a');
  },
};

$(function () {
  $(window).load(function () {
    App.init()
  });
});
