import { expect } from 'chai'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'

const BigNumber = web3.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const Exchange = artifacts.require('Exchange')
const CrowdsaleToken = artifacts.require('CrowdsaleToken')

contract('Exchange', accounts => {
  const ETHER_ADDRESS = '0x0'

  beforeEach(async function () {
    this.exchange = await Exchange.new()
    this.erc20Token = await CrowdsaleToken.new("ERC20 TOKEN", "TKN", { from: accounts[0] })
    this.depositAccount = accounts[0]
    this.depositAmount = ether(1)
    this.erc20Token.mint(this.depositAccount, ether(10000))

    //deposit ether and erc20 token into exchange for depositAccount
    await this.exchange.deposit({ from: this.depositAccount, value: this.depositAmount })
    await this.erc20Token.approve(this.exchange.address, this.depositAmount, { from: this.depositAccount })
    await this.exchange.depositToken(this.erc20Token.address, this.depositAmount, { from: this.depositAccount })
  })

  it("should be able to deposit and withdraw erc20 token", async function () {
    expect(await this.exchange.balanceOf(this.erc20Token.address, this.depositAccount)).to.be.bignumber.equal(this.depositAmount)
    expect(await this.erc20Token.balanceOf(this.exchange.address)).to.be.bignumber.equal(this.depositAmount)

    const withdrawAmount = ether(1)
    await this.exchange.withdraw(this.erc20Token.address, withdrawAmount, { from: this.depositAccount })
    expect(await this.exchange.balanceOf(this.erc20Token.address, this.depositAccount)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(await this.erc20Token.balanceOf(this.exchange.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
  })

  it("should allow deposit and withdraw of ether", async function () {
    expect(await this.exchange.balanceOf(ETHER_ADDRESS, this.depositAccount)).to.be.bignumber.equal(this.depositAmount)
    expect(web3.eth.getBalance(this.exchange.address)).to.be.bignumber.equal(this.depositAmount)

    const withdrawAmount = ether(1)
    await this.exchange.withdraw(ETHER_ADDRESS, withdrawAmount, { from: this.depositAccount })
    expect(await this.exchange.balanceOf(ETHER_ADDRESS, this.depositAccount)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(web3.eth.getBalance(this.exchange.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
  })

  it("should not allow overdraft of funds", async function () {
    const overDraft = ether(10)
    await this.exchange.withdraw(ETHER_ADDRESS, overDraft, { from: this.depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow deposit of funds value equal to 0", async function () {
    const zeroDepositAmount = ether(0)
    await this.exchange.deposit({ from: this.depositAccount, value: zeroDepositAmount }).should.be.rejectedWith(EVMRevert)

    await this.erc20Token.approve(this.exchange.address, ether(1), { from: this.depositAccount })
    await this.exchange.depositToken(this.erc20Token.address, zeroDepositAmount, { from: this.depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdraw of funds value equal to 0", async function () {
    const zeroWithdrawAmount = ether(0)
    await this.exchange.withdraw(ETHER_ADDRESS, zeroWithdrawAmount, { from: this.depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdrawal of other's funds", async function () {
    const invalidWithdrawAccount = accounts[1]
    await this.exchange.withdraw(ETHER_ADDRESS, this.depositAmount, { from: invalidWithdrawAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not be able to create orders until you fund your balance", async function () {
    const emptyAccount = accounts[1]
    const sellToken = this.erc20Token.address
    const buyToken = ETHER_ADDRESS
    const amount = ether(1)
    await this.exchange.createOrder(sellToken, buyToken, amount, { from: emptyAccount }).should.be.rejectedWith(EVMRevert)
  })
})
