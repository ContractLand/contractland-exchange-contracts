require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gasPrice: 0,
      gasLimit: 10000000
    },
    terra: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://35.237.146.38:8545")
      },
      network_id: '*',
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/KetwbGBGwNagOnjgPUkN")
      },
      gas: 4600000,
      network_id: 3
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/KetwbGBGwNagOnjgPUkN")
      },
      gas: 4600000,
      network_id: 4
    },
  },
  optimizer: {
    "enabled": true,
    "runs": 200
  },
  mocha: {
    enableTimeouts: false
  }
};
