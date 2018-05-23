import { expect } from 'chai'
import ether from './helpers/ether'
import token from './helpers/token'
import EVMRevert from './helpers/EVMRevert'

const BigNumber = web3.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Orderbook = artifacts.require('Orderbook')
const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'
const SOME_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000001'

contract('Orderbook', ([manager, nonManager, creator]) => {
  beforeEach(async function () {
    this.orderbook = await Orderbook.new({from: manager})

    this.newOrder = {
      'creator': creator,
      'tokenGive': ETHER_ADDRESS,
      'tokenGet': SOME_TOKEN_ADDRESS,
      'amountGive': ether(1),
      'amountGet': token(1)
    }
    await this.orderbook.newOrder(this.newOrder.creator, this.newOrder.tokenGive, this.newOrder.tokenGet, this.newOrder.amountGive, this.newOrder.amountGet, {from: manager})
    this.orderId = 0
  })

  it('only manager can create order', async function () {
    expect((await this.orderbook.numOfOrders()).toString()).to.equal('1')
    await this.orderbook.newOrder(this.newOrder.creator, this.newOrder.tokenGive, this.newOrder.tokenGet, this.newOrder.amountGive, this.newOrder.amountGet, {from: nonManager}).should.be.rejectedWith(EVMRevert)
  })

  it('only manager can update order amount give', async function () {
    const newAmountGive = ether(2)
    await this.orderbook.setAmountGive(this.orderId, newAmountGive, {from: manager})
    expect(await this.orderbook.getAmountGive(this.orderId)).to.be.bignumber.equal(newAmountGive)

    await this.orderbook.setAmountGive(this.orderId, newAmountGive, {from: nonManager}).should.be.rejectedWith(EVMRevert)
  })

  it('only manager can update order amount get', async function () {
    const newAmountGet= token(2)
    await this.orderbook.setAmountGet(this.orderId, newAmountGet, {from: manager})
    expect(await this.orderbook.getAmountGet(this.orderId)).to.be.bignumber.equal(newAmountGet)

    await this.orderbook.setAmountGet(this.orderId, newAmountGet, {from: nonManager}).should.be.rejectedWith(EVMRevert)
  })
})
