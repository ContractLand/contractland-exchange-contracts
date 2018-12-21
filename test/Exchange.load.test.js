import toWei from './helpers/toWei'
import fromWei from './helpers/fromWei'

const Exchange = artifacts.require("Exchange")
const Token = artifacts.require("./TestToken.sol");

contract('Exchange Load Test',  async(accounts) => {
  const [deployer, buyer, seller] = web3.eth.accounts;
  let exchange, baseToken, tradeToken, orderId
  const tokenDepositAmount = toWei(100);
  const BLOCK_GAS_LIMIT = 100000000
  const TEST_SIZE = 50

  beforeEach(async () => {
      orderId = 1;
      await deployExchange()
      await initBalances()
  })

  it("Test gas usage increment based on matching order increment", async() => {
    const testSize = 10
    const tradeTokenAmount = 0.01
    const price = 1
    const baseTokenAmount = tradeTokenAmount * price * testSize

    // Create testSize orders, // Match with 1 order
    for(let i = 0; i < testSize; i++) {
      await tradeToken.approve(exchange.address, toWei(tradeTokenAmount), { from: seller })
      await exchange.sell(baseToken.address, tradeToken.address, seller, toWei(tradeTokenAmount), toWei(price), { from: seller })
    }
    await baseToken.approve(exchange.address, toWei(baseTokenAmount), { from: buyer })
    const txMatch10 = await exchange.buy(baseToken.address, tradeToken.address, buyer, toWei(baseTokenAmount), toWei(price), { from: buyer, gas: BLOCK_GAS_LIMIT })
    console.log("gas used match 10: ", txMatch10.receipt.gasUsed)

    // Create testSize+1 orders, // Match with 1 order
    for(let i = 0; i < (testSize + 1); i++) {
      await tradeToken.approve(exchange.address, toWei(tradeTokenAmount), { from: seller })
      await exchange.sell(baseToken.address, tradeToken.address, seller, toWei(tradeTokenAmount), toWei(price), { from: seller })
    }
    await baseToken.approve(exchange.address, toWei(baseTokenAmount), { from: buyer })
    const txMatch11 = await exchange.buy(baseToken.address, tradeToken.address, buyer, toWei(baseTokenAmount), toWei(price), { from: buyer, gas: BLOCK_GAS_LIMIT })
    console.log("gas used match 11: ", txMatch11.receipt.gasUsed)

    console.log("gas used per additional match: ", txMatch11.receipt.gasUsed - txMatch10.receipt.gasUsed)
  })

  it("Match many sell orders with a single buy", async() => {
    const tradeTokenAmount = 0.01
    const price = 1
    const baseTokenAmount = tradeTokenAmount * price * TEST_SIZE

    // Create many sell orders
    for(let i = 0; i < TEST_SIZE; i++) {
      await tradeToken.approve(exchange.address, toWei(tradeTokenAmount), { from: seller })
      await exchange.sell(baseToken.address, tradeToken.address, seller, toWei(tradeTokenAmount), toWei(price), { from: seller })
    }
    const lastSellOrder = await exchange.getOrder(TEST_SIZE)
    assert.equal(fromWei(lastSellOrder[3]).toNumber(), price)

    // Buy with a single buy order
    await baseToken.approve(exchange.address, toWei(baseTokenAmount), { from: buyer })
    const tx = await exchange.buy(baseToken.address, tradeToken.address, buyer, toWei(baseTokenAmount), toWei(price), { from: buyer, gas: BLOCK_GAS_LIMIT })
    console.log("gas used: ", tx.receipt.gasUsed)

    // Orderbook should be empty
    const orderBook = await exchange.getOrderBookInfo(baseToken.address, tradeToken.address)
    assert.equal(orderBook[0], 0)
    assert.equal(orderBook[1], 0)
  })

  it("Match many buy orders with a single sell", async() => {
    const baseTokenAmount = 0.01
    const price = 1
    const tradeTokenAmount = baseTokenAmount * price * TEST_SIZE

    // Create many buy orders
    for(let i = 0; i < TEST_SIZE; i++) {
      await baseToken.approve(exchange.address, toWei(baseTokenAmount), { from: buyer })
      const tx = await exchange.buy(baseToken.address, tradeToken.address, buyer, toWei(baseTokenAmount), toWei(price), { from: buyer })
    }
    const lastSellOrder = await exchange.getOrder(TEST_SIZE)
    assert.equal(fromWei(lastSellOrder[3]).toNumber(), price)

    // Buy with a single sell order
    await tradeToken.approve(exchange.address, toWei(tradeTokenAmount), { from: seller })
    const tx = await exchange.sell(baseToken.address, tradeToken.address, seller, toWei(tradeTokenAmount), toWei(price), { from: seller, gas: BLOCK_GAS_LIMIT })
    console.log("gas used: ", tx.receipt.gasUsed)

    // Orderbook should be empty
    const orderBook = await exchange.getOrderBookInfo(baseToken.address, tradeToken.address)
    assert.equal(orderBook[0], 0)
    assert.equal(orderBook[1], 0)
  })

  async function deployExchange() {
      baseToken = await Token.new()
      tradeToken = await Token.new()
      exchange = await Exchange.new({ gas: BLOCK_GAS_LIMIT })
      await exchange.initialize()
  }

  async function initBalances() {
      await baseToken.setBalance(tokenDepositAmount, {from: buyer})
      await tradeToken.setBalance(tokenDepositAmount, {from: seller})
  }
})
