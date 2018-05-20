import { expect } from 'chai'
import ether from './helpers/ether'
import token from './helpers/token'
import EVMRevert from './helpers/EVMRevert'

const BigNumber = web3.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Exchange = artifacts.require('Exchange')
const TestToken = artifacts.require('TestToken')
const FundStore = artifacts.require('FundStore')
const Orderbook = artifacts.require('Orderbook')

contract('Exchange', ([coinbase, depositAccount, makerAccount, takerAccount, invalidAccount]) => {
  const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'

  beforeEach(async function () {
    this.fundStore = await FundStore.new({ from: coinbase })
    this.orderbook = await Orderbook.new({ from: coinbase })
    this.exchange = await Exchange.new(this.fundStore.address, this.orderbook.address, { from: coinbase })
    await this.fundStore.updateManager(this.exchange.address, { from: coinbase })

    this.erc20Token = await TestToken.new({ from: coinbase })
    this.depositAmount = ether(1)

    //fund ether and erc20 token into accounts for depositAccount, makerAccount, and takerAccount
    await web3.eth.sendTransaction({ from: coinbase, to: makerAccount, value: this.depositAmount })
    await web3.eth.sendTransaction({ from: coinbase, to: takerAccount, value: this.depositAmount })
    this.erc20Token.transfer(depositAccount, this.depositAmount, { from: coinbase })
    this.erc20Token.transfer(makerAccount, this.depositAmount, { from: coinbase })
    this.erc20Token.transfer(takerAccount, this.depositAmount, { from: coinbase })
    await this.erc20Token.approve(this.fundStore.address, this.depositAmount, { from: depositAccount })
    await this.erc20Token.approve(this.fundStore.address, this.depositAmount, { from: makerAccount })
    await this.erc20Token.approve(this.fundStore.address, this.depositAmount, { from: takerAccount })
  })

  it("should not be able to create orders until you fund your balance", async function () {
    const emptyAccount = invalidAccount
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = ether(1)
    const amountGet = ether(1)
    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: emptyAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders with zero amountGive or amountGet", async function () {
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const zeroAmount = ether(0)

    // fund maker account
    await this.fundStore.deposit({ from: makerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    await this.exchange.createOrder(tokenGive, tokenGet, zeroAmount, ether(1), { from: makerAccount }).should.be.rejectedWith(EVMRevert)
    await this.exchange.createOrder(tokenGive, tokenGet, ether(1), zeroAmount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders where give and get tokens are the same", async function () {
    const tokenGive = this.erc20Token.address
    const tokenGet = this.erc20Token.address
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    await this.exchange.createOrder(tokenGive, tokenGet, ether(1), ether(1), { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to create and cancel orders", async function () {
    // fund makerAccount
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // should create orders with correct parameters
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = ether(1)
    const amountGet = ether(0.0001)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())
    expect((await this.orderbook.numOfOrders()).toString()).to.equal('1')
    expect((await this.exchange.getOrder(orderId))[0]).to.equal(makerAccount)
    expect((await this.exchange.getOrder(orderId))[1]).to.equal(tokenGive)
    expect((await this.exchange.getOrder(orderId))[2]).to.equal(tokenGet)
    expect((await this.exchange.getOrder(orderId))[3]).to.be.bignumber.equal(amountGive)
    expect((await this.exchange.getOrder(orderId))[4]).to.be.bignumber.equal(amountGet)

    // should emit create order event
    const orderCreateLogs = order.logs
    expect(orderCreateLogs.length).to.equal(1)
    expect(orderCreateLogs[0].event).to.equal('NewOrder')
    expect(orderCreateLogs[0].args._id).to.be.bignumber.equal(orderId)
    expect(orderCreateLogs[0].args._creator).to.equal(makerAccount)
    expect(orderCreateLogs[0].args._tokenGive).to.be.bignumber.equal(tokenGive)
    expect(orderCreateLogs[0].args._tokenGet).to.be.bignumber.equal(tokenGet)
    expect(orderCreateLogs[0].args._amountGive).to.be.bignumber.equal(amountGive)
    expect(orderCreateLogs[0].args._amountGet).to.be.bignumber.equal(amountGet)

    // should not be able to withdraw token listed in order
    await this.fundStore.withdraw(this.erc20Token.address, amountGive, { from: makerAccount }).should.be.rejectedWith(EVMRevert)

    // cancel and withdraw should return user's funds back
    const initialBalance = await this.erc20Token.balanceOf(makerAccount)
    const cancelOrder = await this.exchange.cancelOrder(orderId, { from: makerAccount });
    await this.fundStore.withdraw(this.erc20Token.address, amountGive, { from: makerAccount })
    expect(await this.erc20Token.balanceOf(makerAccount)).to.be.bignumber.equal(initialBalance + amountGive)

    // should emit order cancel event
    const orderCancelLogs = cancelOrder.logs
    expect(orderCancelLogs.length).to.equal(1)
    expect(orderCancelLogs[0].event).to.equal('OrderCancelled')
    expect(orderCancelLogs[0].args._id).to.be.bignumber.equal(orderId)
  })

  it("should disallow cancelling or other people's orders", async function () {
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = this.depositAmount
    const amountGet = ether(0.0001)

    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    const notCreator = invalidAccount
    await this.exchange.cancelOrder(orderId, { from: notCreator }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to cancel orders that are already cancelled", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // cancel order
    await this.exchange.cancelOrder(orderId, { from: makerAccount })

    // cancel again
    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to create multiple orders", async function () {
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = ether(0.5)
    const amountGet = ether(0.0001)

    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create orders
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderOneId = parseInt(orderOne.logs[0].args._id.toString())
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderTwoId = parseInt(orderOne.logs[0].args._id.toString())

    // verify orders are created
    expect((await this.orderbook.numOfOrders()).toString()).to.equal('2')
    expect((await this.exchange.getOrder(orderOneId))[0]).to.equal(makerAccount)
    expect((await this.exchange.getOrder(orderTwoId))[0]).to.equal(makerAccount)

    // should fail due to out of funds
    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should adjust account balances properly when executing trade", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(0.01)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // get balances before order execution
    const makerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, makerAccount)
    const takerInitialTokenGiveBalance = await this.exchange.balanceOf(tokenGive, takerAccount)
    const takerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, takerAccount)

    // execute order
    const amountFill = token(0.5)
    const trade = await this.exchange.executeOrder(orderId, amountFill, false, { from: takerAccount })
    // rate is 0.01 / 1 = 0.01 ethers per token
    // for 0.5 tokens, you get 0.5 * 0.01 = 0.005 ethers
    const expectedMakerTokenGetAmount = ether(0.005)
    // taker and maker should have correct balance after trade
    expect(await this.exchange.balanceOf(tokenGet, makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance + expectedMakerTokenGetAmount)
    expect((await this.exchange.getOrder(orderId))[3]).to.be.bignumber.equal(amountGive - amountFill)
    expect(await this.exchange.balanceOf(tokenGive, takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance + amountFill)
    expect(await this.exchange.balanceOf(tokenGet, takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance - expectedMakerTokenGetAmount)

    // should emit trade event
    const logs = trade.logs
    expect(logs.length).to.equal(1)
    expect(logs[0].event).to.equal('Trade')
    expect(logs[0].args._taker).to.equal(takerAccount)
    expect(logs[0].args._maker).to.equal(makerAccount)
    expect(logs[0].args._orderId).to.be.bignumber.equal(orderId)
    expect(logs[0].args._amountFilled).to.be.bignumber.equal(amountFill)
    expect(logs[0].args._amountReceived).to.be.bignumber.equal(expectedMakerTokenGetAmount)
  })

  it("should not execute trade if taker does not have enough fund to fulfill the order", async function () {
    // fund maker accounts
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    const deficientFundAccount = invalidAccount
    await this.exchange.executeOrder(orderId, amountFill, false, { from: deficientFundAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute trade if fill amount exceed order capacity", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(0.1)
    const amountGet = ether(0.1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const overFillAmount = token(1)
    await this.exchange.executeOrder(orderId, overFillAmount, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that does not exist", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId + 1, amountFill, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that fill 0 amount", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const zeroFillAmount = token(0)
    await this.exchange.executeOrder(orderId, zeroFillAmount, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not let user trade against themselfs", async function () {
    // fund maker accounts
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })
    await this.fundStore.deposit({ from: makerAccount, value: this.depositAmount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId, amountFill, false, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  });

  it("should not be able to cancel orders that has already been fulfilled", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // fill entire order
    const fillAll = token(1)
    await this.exchange.executeOrder(orderId, fillAll, false, { from: takerAccount })

    // try to cancel
    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should emit OrderFulfilled event when order is fully filled", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = order.logs[0].args._id

    // fill entire order
    const fillAll = token(1)
    const { logs } = await this.exchange.executeOrder(orderId, fillAll, false, { from: takerAccount })

    // emit log
    expect(logs.length).to.equal(2)
    expect(logs[1].event).to.equal('OrderFulfilled')
    expect(logs[1].args._id).to.be.bignumber.equal(orderId)
  })

  it("should be able to batch execute orders", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(0.5)
    const amountGet = ether(0.5)

    // create sell order 1
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderOneId = orderOne.logs[0].args._id

    // create sell order 2
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderTwoId = orderTwo.logs[0].args._id

    // get balances before order execution
    const makerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, makerAccount)
    const takerInitialTokenGiveBalance = await this.exchange.balanceOf(tokenGive, takerAccount)
    const takerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, takerAccount)

    // fill order with amount of both orders
    const orderIds = [orderOneId, orderTwoId]
    const fillAmounts = [token(0.5), token(0.5)]
    await this.exchange.batchExecute(orderIds, fillAmounts, false, { from: takerAccount })

    const expectedMakerTokenGetAmount = ether(1) //0.5 + 0.5
    const totalAmountFill = token(1)
    // taker and maker should have correct balance after trade
    expect(await this.exchange.balanceOf(tokenGet, makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance + expectedMakerTokenGetAmount)
    expect(await this.exchange.balanceOf(tokenGive, takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance + totalAmountFill)
    expect(await this.exchange.balanceOf(tokenGet, takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance - expectedMakerTokenGetAmount)
  })

  it("should allow partial fill of order if take amount exceeds remaining order amount", async function () {
    // fund taker and maker accounts
    await this.fundStore.deposit({ from: takerAccount, value: this.depositAmount })
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)

    // create order
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = order.logs[0].args._id

    // get balances before order execution
    const makerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, makerAccount)
    const takerInitialTokenGiveBalance = await this.exchange.balanceOf(tokenGive, takerAccount)
    const takerInitialTokenGetBalance = await this.exchange.balanceOf(tokenGet, takerAccount)

    // fill order with amount of both orders
    const excessfillAmount = token(2)
    const allowPartialFill = true
    await this.exchange.executeOrder(orderId, excessfillAmount, allowPartialFill, { from: takerAccount })

    const expectedMakerTokenGetAmount = ether(1)
    const expectedFillAmount = amountGive
    // taker and maker should have correct balance after trade
    expect(await this.exchange.balanceOf(tokenGet, makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance + expectedMakerTokenGetAmount)
    expect(await this.exchange.balanceOf(tokenGive, takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance + expectedFillAmount)
    expect(await this.exchange.balanceOf(tokenGet, takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance - expectedMakerTokenGetAmount)
  })

  it.skip("should collect exchange fee from taker", async function () {

  })

  it.skip("should collect exchange fee from maker", async function () {

  })
})
