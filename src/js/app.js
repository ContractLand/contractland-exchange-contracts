let App = {
  web3Provider: null,
  account: "",
  contracts: {},

  init: function () {
    return App.initWeb3();
  },

  initWeb3: function () {
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

    return App.initContract();
  },

  initContract: async function () {
    const CrowdsaleTokenArtifact = await $.getJSON('CrowdsaleToken.json')
    // Get the necessary contract artifact file and instantiate it with truffle-contract.
    const CrowdsaleToken = TruffleContract(CrowdsaleTokenArtifact);
    // Set the provider for our contract.
    CrowdsaleToken.setProvider(App.web3Provider);
    App.contracts.CrowdsaleTokenInstance = await CrowdsaleToken.deployed();

    const SimpleCrowdsaleArtifact = await $.getJSON('SimpleCrowdsale.json')
    const SimpleCrowdsale = TruffleContract(SimpleCrowdsaleArtifact);
    SimpleCrowdsale.setProvider(App.web3Provider);
    App.contracts.SimpleCrowdsaleInstance = await SimpleCrowdsale.at("0x2c2b9c9a4a25e24b174f26114e8926a9f2128fe4");

    return App.getContractInfo();
    return App.bindEvents();
  },

  bindEvents: function () {
    $(document).on('click', '#transferButton', App.handleTransfer);
  },

  handleTransfer: function (event) {
    event.preventDefault();

    var amount = parseInt($('#TTTransferAmount').val());
    var toAddress = $('#TTTransferAddress').val();

    console.log('Transfer ' + amount + ' TT to ' + toAddress);

    var tutorialTokenInstance;

    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      var account = accounts[0];

      App.contracts.TutorialToken.deployed().then(function (instance) {
        tutorialTokenInstance = instance;

        return tutorialTokenInstance.transfer(toAddress, amount, { from: account });
      }).then(function (result) {
        alert('Transfer Successful!');
        return App.getBalances();
      }).catch(function (err) {
        console.log(err.message);
      });
    });
  },

  getContractInfo: async function () {
    console.log('Getting contract info...');

    try {
      const name = await App.contracts.CrowdsaleTokenInstance.name();
      const symbol = await App.contracts.CrowdsaleTokenInstance.symbol();
      const startTime = await App.contracts.SimpleCrowdsaleInstance.startTime();
      const endTime = await App.contracts.SimpleCrowdsaleInstance.endTime();
      const weiRaised = await App.contracts.SimpleCrowdsaleInstance.weiRaised();
      const etherRaised = web3.fromWei(weiRaised, 'ether');
      const balance = await App.contracts.CrowdsaleTokenInstance.balanceOf(App.account);

      $('#TokenName').text(name);
      $('#TokenSymbol').text(symbol);
      $('#StartTime').text(startTime);
      $('#EndTime').text(endTime);
      $('#EtherRaised').text(etherRaised);
      $('#Balance').text(balance);
    } catch (e) {
      console.log(e);
    }
  },

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
