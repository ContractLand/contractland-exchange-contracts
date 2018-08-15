const Web3Utils = require('web3-utils')
require('dotenv').config({
  path: __dirname + '/../.env'
});

const assert = require('assert');

const {deployContract, sendRawTx, compareHex} = require('./deploymentUtils');
const {web3Provider, deploymentPrivateKey, RPC_URL, PROXY_ADMIN_ADDRESS_SLOT} = require('./web3');

const Proxy = require('../../build/contracts/AdminUpgradeabilityProxy.json');
const Exchange = require('../../build/contracts/Exchange.json')

const {
  DEPLOYMENT_ACCOUNT_ADDRESS,
  EXCHANGE_OWNER_MULTISIG,
  EXCHANGE_UPGRADEABLE_ADMIN
} = process.env;

async function deployExchange()
{
  let nonce = await web3Provider.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS);

  console.log('========================================')
  console.log('deploying Exchange')
  console.log('========================================\n')

  console.log('\ndeploying implementation for exchange:')
  let exchangeImplementation = await deployContract(Exchange, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: nonce})
  console.log('Exchange Implementation: ', exchangeImplementation.options.address)
  nonce++;

  console.log('\ndeploying proxy for exchange:')
  let exchangeProxy = await deployContract(Proxy, [exchangeImplementation.options.address], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: nonce})
  console.log('Exchange Proxy: ', exchangeProxy.options.address)
  nonce++;

  console.log('\ntransferring proxy ownership to multisig for Exchange Proxy contract:');
  const proxyDataTransfer = await exchangeProxy.methods.changeAdmin(EXCHANGE_UPGRADEABLE_ADMIN).encodeABI();
  const txProxyDataTransfer = await sendRawTx({
    data: proxyDataTransfer,
    nonce: nonce,
    to: exchangeProxy.options.address,
    privateKey: deploymentPrivateKey,
    url: RPC_URL
  })
  assert.equal(txProxyDataTransfer.status, '0x1', 'Transaction Failed');
  const newProxyOwner = await web3Provider.eth.getStorageAt(exchangeProxy.options.address, web3Provider.utils.toBN(PROXY_ADMIN_ADDRESS_SLOT))
  assert.ok(compareHex(newProxyOwner.toLocaleLowerCase(), EXCHANGE_UPGRADEABLE_ADMIN.toLocaleLowerCase()));
  nonce++;

  let exchangeImplementationAddress = exchangeImplementation.options.address

  console.log(`\ninitializing Exchange contract with owner: ${EXCHANGE_OWNER_MULTISIG}`)
  exchangeImplementation.options.address = exchangeProxy.options.address
  const initializeData = await exchangeImplementation.methods.initialize().encodeABI({from: DEPLOYMENT_ACCOUNT_ADDRESS})
  const txInitialize = await sendRawTx({
    data: initializeData,
    nonce: nonce,
    to: exchangeImplementation.options.address,
    privateKey: deploymentPrivateKey,
    url: RPC_URL
  })
  assert.equal(txInitialize.status, '0x1', 'Transaction Failed');
  const exchangeOwner = await exchangeImplementation.methods.owner().call();
  assert.ok(compareHex(exchangeOwner.toLocaleLowerCase(), DEPLOYMENT_ACCOUNT_ADDRESS.toLocaleLowerCase()));
  nonce++;

  return {
    exchangeImplementation: exchangeImplementationAddress,
    exchangeProxy: exchangeProxy.options.address
  }
}

module.exports = deployExchange;
