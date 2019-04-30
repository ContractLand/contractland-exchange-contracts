const Web3Utils = require('web3-utils')
require('dotenv').config({
  path: __dirname + '/../.env'
});

const assert = require('assert');

const {deployContract, sendRawTx, compareHex} = require('./deploymentUtils');
const {web3Provider, deploymentPrivateKey, RPC_URL} = require('./web3');

const Proxy = require('../../build/contracts/AdminUpgradeabilityProxy.json');
const AskHeap = require('../../build/contracts/AskHeap.json')
const BidHeap = require('../../build/contracts/BidHeap.json')
const Exchange = require('../../build/contracts/Exchange.json')

const {
  DEPLOYMENT_ACCOUNT_ADDRESS,
  EXCHANGE_UPGRADEABLE_ADMIN,
  EXCHANGE_UPGRADEABLE_ADMIN_PRIVATE_KEY,
  EXCHANGE_PROXY_ADDRESS
} = process.env;

function link(contractJson, library, libraryName) {
  const address = library.options.address.replace('0x', '');
  const pattern = new RegExp(`_+${libraryName}_+`, 'g');
  return {...contractJson, bytecode: contractJson.bytecode.replace(pattern, address)};
}

const exchangeProxy = new web3Provider.eth.Contract(Proxy.abi, EXCHANGE_PROXY_ADDRESS)
const proxyOwnerPrivateKey = Buffer.from(EXCHANGE_UPGRADEABLE_ADMIN_PRIVATE_KEY, 'hex')

async function deployExchange()
{
  let deploymentAccountNonce = await web3Provider.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS);
  let proxyOwnerAccountNonce = await web3Provider.eth.getTransactionCount(EXCHANGE_UPGRADEABLE_ADMIN);

  console.log('========================================')
  console.log('upgrading Exchange')
  console.log('========================================\n')

  console.log('\ndeploying AskHeap lib:')
  let askHeap = await deployContract(AskHeap, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: deploymentAccountNonce})
  console.log('AskHeap Library: ', askHeap.options.address)
  deploymentAccountNonce++;

  console.log('\ndeploying BidHeap lib:')
  let bidHeap = await deployContract(BidHeap, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: deploymentAccountNonce})
  console.log('BidHeap Library: ', bidHeap.options.address)
  deploymentAccountNonce++;

  console.log('\ndeploying implementation for exchange:')
  let linkedAsk = link(Exchange, askHeap, 'AskHeap');
  const linkedBid = link(linkedAsk, bidHeap, 'BidHeap');
  let exchangeImplementation = await deployContract(linkedBid, [], {from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce: deploymentAccountNonce})
  console.log('Exchange Implementation: ', exchangeImplementation.options.address)
  deploymentAccountNonce++;

  console.log('\nUpgrading reference in exchange proxy')
  const upgradeData = await exchangeProxy.methods.upgradeTo(exchangeImplementation.options.address).encodeABI()
  const txUpgrade = await sendRawTx({
    data: upgradeData,
    nonce: proxyOwnerAccountNonce,
    to: exchangeProxy.options.address,
    privateKey: proxyOwnerPrivateKey,
    url: RPC_URL
  })
  assert.equal(txUpgrade.status, '0x1', 'Transaction Failed')

  console.log("\n**************************************************")
  console.log("          Upgrade has been completed.          ")
  console.log("**************************************************\n\n")
  console.log(`[ Library  ] AskHeap: ${askHeap.options.address}`)
  console.log(`[ Library  ] BidHeap: ${bidHeap.options.address}`)
  console.log(`[ Exchange ] Implementation: ${exchangeImplementation.options.address}`)
  console.log(`[ Exchange ] Proxy: ${exchangeProxy.options.address}`)
}

deployExchange()
