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

contract('FundStore', ([coinbase, manager, depositAccount, invalidAccount]) => {
  const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'

  beforeEach(async function () {
    this.fundStore = await FundStore.new({ from: coinbase })
    await this.fundStore.updateManager(manager, { from: coinbase })
    this.erc20Token = await TestToken.new({ from: coinbase })

    this.depositAmount = ether(1)
    this.erc20Token.transfer(depositAccount, this.depositAmount, { from: coinbase })
    await this.erc20Token.approve(this.fundStore.address, this.depositAmount, { from: depositAccount })
  })

  it("should only allow the manager to set the token balance of an address", async function () {
    const newBalance = ether(10)

    await this.fundStore.setBalance(depositAccount, ETHER_ADDRESS, newBalance, { from: manager })
    expect(await this.fundStore.balanceOf(depositAccount, ETHER_ADDRESS)).to.be.bignumber.equal(newBalance)
    await this.fundStore.setBalance(depositAccount, ETHER_ADDRESS, newBalance, { from: depositAccount }).should.be.rejectedWith(EVMRevert)
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

    const invalidWithdrawAccount = invalidAccount
    await this.fundStore.withdraw(ETHER_ADDRESS, this.depositAmount, { from: invalidWithdrawAccount }).should.be.rejectedWith(EVMRevert)
  })
})
