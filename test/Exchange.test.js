import { expect } from 'chai'
import token from './helpers/token'
import EVMRevert from './helpers/EVMRevert'

const BigNumber = web3.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Exchange = artifacts.require('Exchange')
const ExchangeProxy = artifacts.require('AdminUpgradeabilityProxy')
const TestToken = artifacts.require('TestToken')

contract('Exchange', ([coinbase, depositAccount, makerAccount, takerAccount, invalidAccount, exchangeOwner, proxyOwner]) => {

  beforeEach(async function () {
    // create contracts
    this.exchangeContract = await Exchange.new({ from: exchangeOwner })
    this.exchangeProxy = await ExchangeProxy.new(this.exchangeContract.address, { from: proxyOwner })
    this.exchange = await Exchange.at(this.exchangeProxy.address)
    await this.exchange.initialize({ from: exchangeOwner })
    this.erc827Token = await TestToken.new(coinbase, { from: coinbase })
    this.anotherERC827Token = await TestToken.new(coinbase, { from: coinbase })

    //fund tokens into accounts
    this.depositAmount = token(1)
    this.erc827Token.transfer(makerAccount, this.depositAmount, { from: coinbase })
    this.erc827Token.transfer(takerAccount, this.depositAmount, { from: coinbase })
    await this.erc827Token.approve(this.exchange.address, this.depositAmount, { from: makerAccount })
    await this.erc827Token.approve(this.exchange.address, this.depositAmount, { from: takerAccount })
    this.anotherERC827Token.transfer(makerAccount, this.depositAmount, { from: coinbase })
    this.anotherERC827Token.transfer(takerAccount, this.depositAmount, { from: coinbase })
    await this.anotherERC827Token.approve(this.exchange.address, this.depositAmount, { from: makerAccount })
    await this.anotherERC827Token.approve(this.exchange.address, this.depositAmount, { from: takerAccount })
  })

  it("should not be able to create orders if you do not have enough token balance", async function () {
    const emptyAccount = invalidAccount
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, emptyAccount, { from: emptyAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders with zero amountGive or amountGet", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const zeroAmount = token(0)

    await this.exchange.createOrder(tokenGive, tokenGet, zeroAmount, this.depositAmount, makerAccount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
    await this.exchange.createOrder(tokenGive, tokenGet, this.depositAmount, zeroAmount, makerAccount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders where give and get tokens are the same", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.erc827Token.address

    await this.exchange.createOrder(tokenGive, tokenGet, this.depositAmount, this.depositAmount, makerAccount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to create and cancel orders", async function () {
    // should create orders with correct parameters
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(0.0001)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())
    expect((await this.exchange.numOfOrders({ from: coinbase })).toString()).to.equal('1')
    expect((await this.exchange.getOrder(orderId, { from: coinbase }))[0]).to.equal(makerAccount)
    expect((await this.exchange.getOrder(orderId, { from: coinbase }))[1]).to.equal(tokenGive)
    expect((await this.exchange.getOrder(orderId, { from: coinbase }))[2]).to.equal(tokenGet)
    expect((await this.exchange.getOrder(orderId, { from: coinbase }))[3]).to.be.bignumber.equal(amountGive)
    expect((await this.exchange.getOrder(orderId, { from: coinbase }))[4]).to.be.bignumber.equal(amountGet)

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

    // cancel order should return user's token back
    const initialBalance = await this.erc827Token.balanceOf(makerAccount)
    const cancelOrder = await this.exchange.cancelOrder(orderId, { from: makerAccount })
    expect(await this.erc827Token.balanceOf(makerAccount)).to.be.bignumber.equal(initialBalance.plus(amountGive))

    // should emit order cancel event
    const orderCancelLogs = cancelOrder.logs
    expect(orderCancelLogs.length).to.equal(1)
    expect(orderCancelLogs[0].event).to.equal('OrderCancelled')
    expect(orderCancelLogs[0].args._id).to.be.bignumber.equal(orderId)
  })

  it("should be able to create an order using approveAndCall of an erc827 token", async function () {
    // should create orders with correct parameters
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(0.5)
    const amountGet = token(0.0001)
    const data = this.exchangeContract.contract.createOrder.getData(tokenGive, tokenGet, amountGive, amountGet, makerAccount)

    await this.erc827Token.approveAndCall(this.exchange.address, amountGive, data, { from: makerAccount })

    // should emit create order event
    const OrderEvent = this.exchange.NewOrder({}, { fromBlock: 0, toBlock: 'latest' }, async (error, order) => {
      if(error) {
        throw "NewOrder event watch error"
      } else {
        const orderId = parseInt(order.args._id.toString())

        expect(order.event).to.equal('NewOrder')
        expect(order.args._id).to.be.bignumber.equal(orderId)
        expect(order.args._creator).to.equal(makerAccount)
        expect(order.args._tokenGive).to.be.bignumber.equal(tokenGive)
        expect(order.args._tokenGet).to.be.bignumber.equal(tokenGet)
        expect(order.args._amountGive).to.be.bignumber.equal(amountGive)
        expect(order.args._amountGet).to.be.bignumber.equal(amountGet)

        expect((await this.exchange.getOrder(orderId, { from: coinbase }))[0]).to.equal(makerAccount)
        expect((await this.exchange.getOrder(orderId, { from: coinbase }))[1]).to.equal(tokenGive)
        expect((await this.exchange.getOrder(orderId, { from: coinbase }))[2]).to.equal(tokenGet)
        expect((await this.exchange.getOrder(orderId, { from: coinbase }))[3]).to.be.bignumber.equal(amountGive)
        expect((await this.exchange.getOrder(orderId, { from: coinbase }))[4]).to.be.bignumber.equal(amountGet)

        // cancel order should return user's token back
        const initialBalance = await this.erc827Token.balanceOf(makerAccount)
        const cancelOrder = await this.exchange.cancelOrder(orderId, { from: makerAccount })
        expect(await this.erc827Token.balanceOf(makerAccount)).to.be.bignumber.equal(initialBalance.plus(amountGive))

        // should emit order cancel event
        const orderCancelLogs = cancelOrder.logs
        expect(orderCancelLogs.length).to.equal(1)
        expect(orderCancelLogs[0].event).to.equal('OrderCancelled')
        expect(orderCancelLogs[0].args._id).to.be.bignumber.equal(orderId)
      }
    })
    expect((await this.exchange.numOfOrders({ from: coinbase })).toString()).to.equal('1')
  })

  it("should disallow cancelling of other people's orders", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = this.depositAmount
    const amountGet = token(0.0001)

    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    const notCreator = invalidAccount
    await this.exchange.cancelOrder(orderId, { from: notCreator }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to cancel orders that are already cancelled", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // cancel order
    await this.exchange.cancelOrder(orderId, { from: makerAccount })

    // cancel again
    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to create multiple orders", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(0.5)
    const amountGet = token(0.0001)

    // create orders
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderOneId = parseInt(orderOne.logs[0].args._id.toString())
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderTwoId = parseInt(orderOne.logs[0].args._id.toString())

    // verify orders are created
    expect((await this.exchange.numOfOrders({ from: coinbase })).toString()).to.equal('2')
    expect((await this.exchange.getOrder(orderOneId, { from: coinbase }))[0]).to.equal(makerAccount)
    expect((await this.exchange.getOrder(orderTwoId, { from: coinbase }))[0]).to.equal(makerAccount)

    // should fail due to out of funds
    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should adjust account balances properly when executing trade", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(0.01)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // get balances before order execution
    let makerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(makerAccount)
    let takerInitialTokenGiveBalance = await this.erc827Token.balanceOf(takerAccount)
    let takerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(takerAccount)

    // execute order
    let amountFill = token(0.5)
    // rate is 0.01 / 1 = 0.01 tokenGet per tokenGive
    // for 0.5 tokenGive, you get 0.5 * 0.01 = 0.005 tokenGet
    let expectedMakerTokenGetAmount = token(0.005)
    let trade = await this.exchange.executeOrder(orderId, amountFill, false, { from: takerAccount })
    // taker and maker should have correct balance after trade
    expect(await this.anotherERC827Token.balanceOf(makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance.plus(expectedMakerTokenGetAmount))
    expect((await this.exchange.getOrder(orderId))[3]).to.be.bignumber.equal(amountGive.minus(amountFill))
    expect(await this.erc827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance.plus(amountFill))
    expect(await this.anotherERC827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance.minus(expectedMakerTokenGetAmount))

    // should emit trade event
    const logs = trade.logs
    expect(logs.length).to.equal(1)
    expect(logs[0].event).to.equal('Trade')
    expect(logs[0].args._taker).to.equal(takerAccount)
    expect(logs[0].args._maker).to.equal(makerAccount)
    expect(logs[0].args._orderId).to.be.bignumber.equal(orderId)
    expect(logs[0].args._amountFilled).to.be.bignumber.equal(amountFill)
    expect(logs[0].args._amountReceived).to.be.bignumber.equal(expectedMakerTokenGetAmount)

    //execute rest of orders

    // get balances before order execution
    makerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(makerAccount)
    takerInitialTokenGiveBalance = await this.erc827Token.balanceOf(takerAccount)
    takerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(takerAccount)

    amountFill = token(0.5)
    expectedMakerTokenGetAmount = token(0.005)
    trade = await this.exchange.executeOrder(orderId, amountFill, false, { from: takerAccount })

    expect(await this.anotherERC827Token.balanceOf(makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance.plus(expectedMakerTokenGetAmount))
    expect((await this.exchange.getOrder(orderId))[3]).to.be.bignumber.equal(token(0))
    expect(await this.erc827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance.plus(amountFill))
    expect(await this.anotherERC827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance.minus(expectedMakerTokenGetAmount))
  })

  it("should not execute trade if taker does have enough token to fulfill a order", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(0.01)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId, amountFill, false, { from: invalidAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute trade if fill amount exceed order capacity", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(0.1)
    const amountGet = token(0.1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const overFillAmount = token(1)
    await this.exchange.executeOrder(orderId, overFillAmount, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that does not exist", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId + 1, amountFill, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that fill 0 amount", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const zeroFillAmount = token(0)
    await this.exchange.executeOrder(orderId, zeroFillAmount, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not let user trade against themselfs", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId, amountFill, false, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to cancel orders that has already been fulfilled", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // fill entire order
    const fillAll = token(1)
    await this.exchange.executeOrder(orderId, fillAll, false, { from: takerAccount })

    // try to cancel
    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should emit OrderFulfilled event when order is fully filled", async function () {
    // create order
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
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
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(0.5)
    const amountGet = token(0.5)

    // create sell order 1
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderOneId = orderOne.logs[0].args._id

    // create sell order 2
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderTwoId = orderTwo.logs[0].args._id

    // get balances before order execution
    const makerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(makerAccount)
    const takerInitialTokenGiveBalance = await this.erc827Token.balanceOf(takerAccount)
    const takerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(takerAccount)

    // fill order with amount of both orders
    const orderIds = [orderOneId, orderTwoId]
    const fillAmounts = [token(0.5), token(0.5)]
    const expectedMakerTokenGetAmountTotal = token(1) //0.5 + 0.5
    await this.exchange.batchExecute(orderIds, fillAmounts, false, { from: takerAccount })

    const totalAmountFill = token(1)
    // taker and maker should have correct balance after trade
    expect(await this.anotherERC827Token.balanceOf(makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance.plus(expectedMakerTokenGetAmountTotal))
    expect(await this.erc827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance.plus(totalAmountFill))
    expect(await this.anotherERC827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance.minus(expectedMakerTokenGetAmountTotal))
  })

  it("should allow partial fill of order if take amount exceeds remaining order amount", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)

    // create order
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = order.logs[0].args._id

    // get balances before order execution
    const makerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(makerAccount)
    const takerInitialTokenGiveBalance = await this.erc827Token.balanceOf(takerAccount)
    const takerInitialTokenGetBalance = await this.anotherERC827Token.balanceOf(takerAccount)

    // fill order with amount of both orders
    const excessfillAmount = token(2)
    const allowPartialFill = true
    await this.exchange.executeOrder(orderId, excessfillAmount, allowPartialFill, { from: takerAccount })

    const expectedMakerTokenGetAmount = token(1)
    const expectedFillAmount = amountGive
    // taker and maker should have correct balance after trade
    expect(await this.anotherERC827Token.balanceOf(makerAccount)).to.be.bignumber.equal(makerInitialTokenGetBalance.plus(expectedMakerTokenGetAmount))
    expect(await this.erc827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGiveBalance.plus(expectedFillAmount))
    expect(await this.anotherERC827Token.balanceOf(takerAccount)).to.be.bignumber.equal(takerInitialTokenGetBalance.minus(expectedMakerTokenGetAmount))
  })

  it("should not allow non-owner to pause exchange", async function () {
    await this.exchange.pause({ from: invalidAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create order when paused", async function () {
    await this.exchange.pause({ from: exchangeOwner })

    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)

    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to cancel order when paused", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)

    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    await this.exchange.pause({ from: exchangeOwner })

    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to execute order when paused", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(1)
    const amountGet = token(1)

    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    await this.exchange.pause({ from: exchangeOwner })

    let amountFill = token(0.5)
    await this.exchange.executeOrder(orderId, amountFill, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be not able to batch execute orders when paused", async function () {
    const tokenGive = this.erc827Token.address
    const tokenGet = this.anotherERC827Token.address
    const amountGive = token(0.5)
    const amountGet = token(0.5)

    // create sell order 1
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderOneId = orderOne.logs[0].args._id

    // create sell order 2
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, makerAccount, { from: makerAccount })
    const orderTwoId = orderTwo.logs[0].args._id

    await this.exchange.pause({ from: exchangeOwner })

    // fill order with amount of both orders
    const orderIds = [orderOneId, orderTwoId]
    const fillAmounts = [token(0.5), token(0.5)]
    await this.exchange.batchExecute(orderIds, fillAmounts, false, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it.skip("should collect exchange fee from taker", async function () {

  })

  it.skip("should collect exchange fee from maker", async function () {

  })
})
