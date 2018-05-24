import { expect } from 'chai'
import ether from './helpers/ether'
import token from './helpers/token'
import EVMRevert from './helpers/EVMRevert'

const BigNumber = web3.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const FundStore = artifacts.require('FundStore')
const TestToken = artifacts.require('TestToken')

contract('FundStore', ([coinbase, manager, depositAccount, receipient, invalidAccount]) => {
  const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  beforeEach(async function () {
    this.fundStore = await FundStore.new({ from: coinbase })
    await this.fundStore.updateManager(manager, { from: coinbase })
    this.erc20Token = await TestToken.new({ from: coinbase })

    this.depositAmount = ether(1)
    this.erc20Token.transfer(depositAccount, this.depositAmount, { from: coinbase })
    await this.erc20Token.approve(this.fundStore.address, this.depositAmount, { from: depositAccount })
  })

  it("should be able to deposit funds", async function () {
    // erc20 token
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: depositAccount })
    expect(await this.fundStore.balanceOf(depositAccount, this.erc20Token.address)).to.be.bignumber.equal(this.depositAmount)
    expect(await this.erc20Token.balanceOf(this.fundStore.address)).to.be.bignumber.equal(this.depositAmount)

    // ether
    const depositTx = await this.fundStore.deposit({ from: depositAccount, value: this.depositAmount })
    expect(await this.fundStore.balanceOf(depositAccount, ETHER_ADDRESS)).to.be.bignumber.equal(this.depositAmount)
    expect(web3.eth.getBalance(this.fundStore.address)).to.be.bignumber.equal(this.depositAmount)

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
    await this.fundStore.depositToken(this.erc20Token.address, this.depositAmount, { from: depositAccount })
    await this.fundStore.withdraw(this.erc20Token.address, withdrawAmount, { from: depositAccount })
    expect(await this.fundStore.balanceOf(depositAccount, this.erc20Token.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(await this.erc20Token.balanceOf(this.fundStore.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)

    // ether
    await this.fundStore.deposit({ from: depositAccount, value: this.depositAmount })
    const withdrawTx = await this.fundStore.withdraw(ETHER_ADDRESS, withdrawAmount, { from: depositAccount })
    expect(await this.fundStore.balanceOf(depositAccount, ETHER_ADDRESS)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)
    expect(web3.eth.getBalance(this.fundStore.address)).to.be.bignumber.equal(this.depositAmount - withdrawAmount)

    // should emit withdraw event
    const logs = withdrawTx.logs
    expect(logs.length).to.equal(1)
    expect(logs[0].event).to.equal('Withdraw')
    expect(logs[0].args._token).to.equal(ETHER_ADDRESS)
    expect(logs[0].args._owner).to.equal(depositAccount)
    expect(logs[0].args._amount).to.be.bignumber.equal(withdrawAmount)
  })

  it("should not allow overdraft of funds", async function () {
    await this.fundStore.deposit({ from: depositAccount, value: this.depositAmount })

    const overDraft = ether(10)
    await this.fundStore.withdraw(ETHER_ADDRESS, overDraft, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow deposit of funds value equal to 0", async function () {
    const zeroDepositAmount = ether(0)
    await this.fundStore.deposit({ from: depositAccount, value: zeroDepositAmount }).should.be.rejectedWith(EVMRevert)

    await this.erc20Token.approve(this.fundStore.address, ether(1), { from: depositAccount })
    await this.fundStore.depositToken(this.erc20Token.address, zeroDepositAmount, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdraw of funds value equal to 0", async function () {
    await this.fundStore.deposit({ from: depositAccount, value: this.depositAmount })

    const zeroWithdrawAmount = ether(0)
    await this.fundStore.withdraw(ETHER_ADDRESS, zeroWithdrawAmount, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow withdrawal of other's funds", async function () {
    await this.fundStore.deposit({ from: depositAccount, value: this.depositAmount })

    await this.fundStore.withdraw(ETHER_ADDRESS, this.depositAmount, { from: invalidAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should only allow the manager to transfer between accounts in fundStore", async function () {
    await this.fundStore.transfer(depositAccount, receipient, ETHER_ADDRESS, ether(1), { from: invalidAccount }).should.be.rejectedWith(EVMRevert)
  })

  it("should only allow transfer to non-zero addresses", async function () {
    const to = ZERO_ADDRESS
    await this.fundStore.transfer(depositAccount, to, ETHER_ADDRESS, ether(1), { from: manager }).should.be.rejectedWith(EVMRevert)
  })

  it("should not allow transfer of value greater than sender's balanec", async function () {
    const tokenAddress = ETHER_ADDRESS
    const value = ether(100)
    const from = depositAccount
    const to = receipient

    await this.fundStore.transfer(from, to, tokenAddress, value, { from: manager }).should.be.rejectedWith(EVMRevert)
  })

  it("should be able to transfer value between accounts", async function () {
    const tokenAddress = ETHER_ADDRESS
    const value = this.depositAmount
    const from = depositAccount
    const to = receipient
    await this.fundStore.deposit({ from: from, value: value })
    const fromBalanceBefore = await this.fundStore.balanceOf(from, tokenAddress)
    const toBalanceBefore = await this.fundStore.balanceOf(to, tokenAddress)

    await this.fundStore.transfer(from, to, tokenAddress, value, { from: manager })

    expect(await this.fundStore.balanceOf(from, tokenAddress)).to.be.bignumber.equal(fromBalanceBefore.minus(value))
    expect(await this.fundStore.balanceOf(to, tokenAddress )).to.be.bignumber.equal(toBalanceBefore.plus(value))
  })
})
