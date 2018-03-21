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
const CrowdsaleToken = artifacts.require('CrowdsaleToken')

contract('Exchange', ([coinbase, depositAccount, makerAccount, takerAccount, invalidAccount]) => {
  const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'

  beforeEach(async function () {
    this.exchange = await Exchange.new()
    this.erc20Token = await CrowdsaleToken.new("ERC20 TOKEN", "TKN", { from: coinbase })
    this.depositAmount = ether(1)
    this.erc20Token.mint(depositAccount, this.depositAmount)
    this.erc20Token.mint(makerAccount, this.depositAmount)
    this.erc20Token.mint(takerAccount, this.depositAmount)

    //fund ether and erc20 token into accounts for depositAccount, makerAccount, and takerAccount
    await web3.eth.sendTransaction({ from: coinbase, to: makerAccount, value: this.depositAmount })
    await web3.eth.sendTransaction({ from: coinbase, to: takerAccount, value: this.depositAmount })
    await this.erc20Token.approve(this.exchange.address, this.depositAmount, { from: depositAccount })
    await this.erc20Token.approve(this.exchange.address, this.depositAmount, { from: makerAccount })
    await this.erc20Token.approve(this.exchange.address, this.depositAmount, { from: takerAccount })
  })

  it("should be able to deposit funds", async function () {
    // erc20 token
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: depositAccount })
    expect(await this.exchange.balanceOf(this.erc20Token.address, depositAccount)).to.be.bignumber.equal(this.depositAmount)
    expect(await this.erc20Token.balanceOf(this.exchange.address)).to.be.bignumber.equal(this.depositAmount)

    // ether
    const depositTx = await this.exchange.deposit({ from: depositAccount, value: this.depositAmount })
    expect(await this.exchange.balanceOf(ETHER_ADDRESS, depositAccount)).to.be.bignumber.equal(this.depositAmount)
    expect(web3.eth.getBalance(this.exchange.address)).to.be.bignumber.equal(this.depositAmount)

    // should emit deposit event
    const logs = depositTx.logs
    expect(logs.length).to.equal(1)
    expect(logs[0].event).to.equal('Deposit')
    expect(logs[0].args._token).to.equal(ETHER_ADDRESS)
    expect(logs[0].args._owner).to.equal(depositAccount)
    expect(logs[0].args._amount).to.be.bignumber.equal(this.depositAmount)
  })

  it("should allow withdraw funds", async function () {
    const withdrawAmount = this.depositAmount

    // erc20 token
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: depositAccount })
    await this.exchange.withdraw(this.erc20Token.address, withdrawAmount, { from: depositAccount })
    expect(await this.exchange.balanceOf(this.erc20Token.address, depositAccount)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(await this.erc20Token.balanceOf(this.exchange.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)

    // ether
    await this.exchange.deposit({ from: depositAccount, value: this.depositAmount })
    const withdrawTx = await this.exchange.withdraw(ETHER_ADDRESS, withdrawAmount, { from: depositAccount })
    expect(await this.exchange.balanceOf(ETHER_ADDRESS, depositAccount)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(web3.eth.getBalance(this.exchange.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)

    // should emit withdraw event
    const logs = withdrawTx.logs
    expect(logs.length).to.equal(1)
    expect(logs[0].event).to.equal('Withdraw')
    expect(logs[0].args._token).to.equal(ETHER_ADDRESS)
    expect(logs[0].args._owner).to.equal(depositAccount)
    expect(logs[0].args._amount).to.be.bignumber.equal(withdrawAmount)
  })

  it("should not allow overdraft of funds", async function () {
    await this.exchange.deposit({ from: depositAccount, value: this.depositAmount })

    const overDraft = ether(10)
    await this.exchange.withdraw(ETHER_ADDRESS, overDraft, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow deposit of funds value equal to 0", async function () {
    const zeroDepositAmount = ether(0)
    await this.exchange.deposit({ from: depositAccount, value: zeroDepositAmount }).should.be.rejectedWith(EVMRevert)

    await this.erc20Token.approve(this.exchange.address, ether(1), { from: depositAccount })
    await this.exchange.depositToken(this.erc20Token.address, zeroDepositAmount, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdraw of funds value equal to 0", async function () {
    await this.exchange.deposit({ from: depositAccount, value: this.depositAmount })

    const zeroWithdrawAmount = ether(0)
    await this.exchange.withdraw(ETHER_ADDRESS, zeroWithdrawAmount, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdrawal of other's funds", async function () {
    await this.exchange.deposit({ from: depositAccount, value: this.depositAmount })

    const invalidWithdrawAccount = invalidAccount
    await this.exchange.withdraw(ETHER_ADDRESS, this.depositAmount, { from: invalidWithdrawAccount }).should.be.rejectedWith(EVMRevert)
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
    await this.exchange.deposit({ from: makerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    await this.exchange.createOrder(tokenGive, tokenGet, zeroAmount, ether(1), { from: makerAccount }).should.be.rejectedWith(EVMRevert)
    await this.exchange.createOrder(tokenGive, tokenGet, ether(1), zeroAmount, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders where give and get tokens are the same", async function () {
    const tokenGive = this.erc20Token.address
    const tokenGet = this.erc20Token.address
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    await this.exchange.createOrder(tokenGive, tokenGet, ether(1), ether(1), { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to create and cancel orders", async function () {
    // fund makerAccount
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // should create orders with correct parameters
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = ether(1)
    const amountGet = ether(0.0001)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())
    expect((await this.exchange.numOfOrders()).toString()).to.equal('1')
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
    await this.exchange.withdraw(this.erc20Token.address, amountGive, { from: makerAccount }).should.be.rejectedWith(EVMRevert)

    // cancel and withdraw should return user's funds back
    const initialBalance = await this.erc20Token.balanceOf(makerAccount)
    const cancelOrder = await this.exchange.cancelOrder(orderId, { from: makerAccount });
    await this.exchange.withdraw(this.erc20Token.address, amountGive, { from: makerAccount })
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

    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    const notCreator = invalidAccount
    await this.exchange.cancelOrder(orderId, { from: notCreator }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to cancel orders that are already cancelled", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

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

    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create orders
    const orderOne = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderOneId = parseInt(orderOne.logs[0].args._id.toString())
    const orderTwo = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderTwoId = parseInt(orderOne.logs[0].args._id.toString())

    // verify orders are created
    expect((await this.exchange.numOfOrders()).toString()).to.equal('2')
    expect((await this.exchange.getOrder(orderOneId))[0]).to.equal(makerAccount)
    expect((await this.exchange.getOrder(orderTwoId))[0]).to.equal(makerAccount)

    // should fail due to out of funds
    await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should adjust account balances properly when executing trade", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

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
    const trade = await this.exchange.executeOrder(orderId, amountFill, { from: takerAccount })
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
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

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
    await this.exchange.executeOrder(orderId, amountFill, { from: deficientFundAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute trade if fill amount exceed order capacity", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(0.1)
    const amountGet = ether(0.1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const overFillAmount = token(1)
    await this.exchange.executeOrder(orderId, overFillAmount, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that does not exist", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId + 1, amountFill, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not execute orders that fill 0 amount", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const zeroFillAmount = token(0)
    await this.exchange.executeOrder(orderId, zeroFillAmount, { from: takerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not let user trade against themselfs", async function () {
    // fund maker accounts
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })
    await this.exchange.deposit({ from: makerAccount, value: this.depositAmount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // execute order
    const amountFill = token(0.1)
    await this.exchange.executeOrder(orderId, amountFill, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  });

  it("should not be able to cancel orders that has already been fulfilled", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = parseInt(order.logs[0].args._id.toString())

    // fill entire order
    const fillAll = token(1)
    await this.exchange.executeOrder(orderId, fillAll, { from: takerAccount })

    // try to cancel
    await this.exchange.cancelOrder(orderId, { from: makerAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should emit OrderFulfilled event when order is fully filled", async function () {
    // fund taker and maker accounts
    await this.exchange.deposit({ from: takerAccount, value: this.depositAmount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: makerAccount })

    // create order
    const tokenGive = this.erc20Token.address
    const tokenGet = ETHER_ADDRESS
    const amountGive = token(1)
    const amountGet = ether(1)
    const order = await this.exchange.createOrder(tokenGive, tokenGet, amountGive, amountGet, { from: makerAccount })
    const orderId = order.logs[0].args._id

    // fill entire order
    const fillAll = token(1)
    const { logs } = await this.exchange.executeOrder(orderId, fillAll, { from: takerAccount })

    // emit log
    expect(logs.length).to.equal(2)
    expect(logs[1].event).to.equal('OrderFulfilled')
    expect(logs[1].args._id).to.be.bignumber.equal(orderId)
  })

  it.skip("should collect exchange fee from taker", async function () {

  })

  it.skip("should collect exchange fee from maker", async function () {

  })
})
