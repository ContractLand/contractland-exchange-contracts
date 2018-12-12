require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gasPrice: 0,
      gasLimit: 10000000
    },
    localRPC: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545")
      },
      network_id: '*', // Match any network id
      gasLimit: 10000000
    }
  },
  optimizer: {
    "enabled": true,
    "runs": 200
  },
  mocha: {
    enableTimeouts: false
  }
};
