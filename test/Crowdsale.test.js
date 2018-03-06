import ether from './helpers/ether';
import { advanceBlock } from './helpers/advanceToBlock';
import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
import EVMRevert from './helpers/EVMRevert';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const SimpleCrowdsale = artifacts.require('SimpleCrowdsale');
const CrowdsaleToken = artifacts.require('CrowdsaleToken');

contract('SimpleCrowdsale', function ([owner, wallet, investor]) {
  const RATES = [new BigNumber(10), new BigNumber(20)];
  const GOAL = ether(10);
  const CAP = ether(20);

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.rateIncreaseTime = this.openingTime + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(2);
    this.afterclosingTime = this.closingTime + duration.seconds(1);
    this.rateStartTimes = [this.openingTime, this.rateIncreaseTime];

    this.token = await CrowdsaleToken.new('Token Name', 'Token Symbol');
    this.crowdsale = await SimpleCrowdsale.new(
      RATES, this.rateStartTimes, this.closingTime, GOAL, CAP, wallet, this.token.address
    );
    await this.token.transferOwnership(this.crowdsale.address);
  });

  it('should create crowdsale with correct parameters', async function () {
    this.crowdsale.should.exist;
    this.token.should.exist;

    const openingTime = await this.crowdsale.openingTime();
    const closingTime = await this.crowdsale.closingTime();
    const rate = await this.crowdsale.rate();
    const walletAddress = await this.crowdsale.wallet();
    const goal = await this.crowdsale.goal();
    const cap = await this.crowdsale.cap();

    openingTime.should.be.bignumber.equal(this.openingTime);
    closingTime.should.be.bignumber.equal(this.closingTime);
    rate.should.be.bignumber.equal(RATES[0]);
    walletAddress.should.be.equal(wallet);
    goal.should.be.bignumber.equal(GOAL);
    cap.should.be.bignumber.equal(CAP);
  });

  it('should not accept payments before start', async function () {
    await this.crowdsale.send(ether(1)).should.be.rejectedWith(EVMRevert);
    await this.crowdsale.buyTokens(investor, { from: investor, value: ether(1) }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept payments during the sale', async function () {
    const investmentAmount = ether(1);
    const expectedTokenAmount = RATES[0].mul(investmentAmount);

    await increaseTimeTo(this.openingTime);
    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: investor }).should.be.fulfilled;

    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
    (await this.token.totalSupply()).should.be.bignumber.equal(expectedTokenAmount);
  });

  it('should allow a dynamic pricing strategy', async function () {
    const investmentAmount = ether(1);
    const expectedTokenAmount = RATES[1].mul(investmentAmount);

    await increaseTimeTo(this.rateIncreaseTime);
    (await this.crowdsale.getCurrentRate()).should.be.bignumber.equal(RATES[1]);

    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: investor }).should.be.fulfilled;
    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
    (await this.token.totalSupply()).should.be.bignumber.equal(expectedTokenAmount);
  });

  it('should reject payments after end', async function () {
    await increaseTimeTo(this.afterEnd);
    await this.crowdsale.send(ether(1)).should.be.rejectedWith(EVMRevert);
    await this.crowdsale.buyTokens(investor, { value: ether(1), from: investor }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject payments over cap', async function () {
    await increaseTimeTo(this.openingTime);
    await this.crowdsale.send(CAP);
    await this.crowdsale.send(1).should.be.rejectedWith(EVMRevert);
  });

  it('should allow finalization and transfer funds to wallet if the goal is reached', async function () {
    await increaseTimeTo(this.openingTime);
    await this.crowdsale.send(GOAL);

    const beforeFinalization = web3.eth.getBalance(wallet);
    await increaseTimeTo(this.afterclosingTime);
    await this.crowdsale.finalize({ from: owner });
    const afterFinalization = web3.eth.getBalance(wallet);

    afterFinalization.minus(beforeFinalization).should.be.bignumber.equal(GOAL);
  });

  it('should allow refunds if the goal is not reached', async function () {
    const balanceBeforeInvestment = web3.eth.getBalance(investor);

    await increaseTimeTo(this.openingTime);
    await this.crowdsale.sendTransaction({ value: ether(1), from: investor, gasPrice: 0 });
    await increaseTimeTo(this.afterclosingTime);

    await this.crowdsale.finalize({ from: owner });
    await this.crowdsale.claimRefund({ from: investor, gasPrice: 0 }).should.be.fulfilled;

    const balanceAfterRefund = web3.eth.getBalance(investor);
    balanceBeforeInvestment.should.be.bignumber.equal(balanceAfterRefund);
  });
});
