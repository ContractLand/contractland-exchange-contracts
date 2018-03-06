import { expect } from 'chai';
import ether from './helpers/ether';
import { advanceBlock } from './helpers/advanceToBlock';
import { duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
import EVMRevert from './helpers/EVMRevert';

const CrowdsaleFactory = artifacts.require('CrowdsaleFactory');
const SimpleCrowdsale = artifacts.require('SimpleCrowdsale');
const CrowdsaleToken = artifacts.require('CrowdsaleToken');

const BigNumber = web3.BigNumber;

contract('CrowdsaleFactory', function ([factoryOwner, crowdsaleCreator, wallet, investor, notFactoryOwner]) {
  const TOKEN_NAME = 'Name';
  const TOKEN_SYMBOL = 'Symbol';
  const RATE = new BigNumber(10);
  const GOAL = ether(10);
  const CAP = ether(20);

  const PAYMENT = ether(1)

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);

    this.crowdsaleFactory = await CrowdsaleFactory.new();
  });

  it('should create token and crowdsale with correct parameters', async function () {
    await this.crowdsaleFactory.createCrowdsale(
      TOKEN_NAME, TOKEN_SYMBOL, [RATE], [this.openingTime], this.closingTime, GOAL, CAP, wallet, { from: crowdsaleCreator, value: PAYMENT }
    );

    const crowdsale = SimpleCrowdsale.at(await this.crowdsaleFactory.creatorToCrowdsaleMap(crowdsaleCreator, 0));
    expect(crowdsale).to.exist;
    expect(await crowdsale.openingTime()).to.be.bignumber.equal(this.openingTime);
    expect(await crowdsale.closingTime()).to.be.bignumber.equal(this.closingTime);
    expect(await crowdsale.rate()).to.be.bignumber.equal(RATE);
    expect(await crowdsale.wallet()).to.be.equal(wallet);
    expect(await crowdsale.goal()).to.be.bignumber.equal(GOAL);
    expect(await crowdsale.cap()).to.be.bignumber.equal(CAP);

    const token = CrowdsaleToken.at(await crowdsale.token());
    expect(token).to.exist;
    expect(await token.name()).to.equal(TOKEN_NAME);
    expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
  });

  it('should transfer token ownership to crowdsale', async function () {
    await this.crowdsaleFactory.createCrowdsale(
      TOKEN_NAME, TOKEN_SYMBOL, [RATE], [this.openingTime], this.closingTime, GOAL, CAP, wallet, { from: crowdsaleCreator, value: PAYMENT }
    );

    const crowdsale = SimpleCrowdsale.at(await this.crowdsaleFactory.creatorToCrowdsaleMap(crowdsaleCreator, 0))
    const token = CrowdsaleToken.at(await crowdsale.token())
    expect(await token.owner()).to.equal(crowdsale.address)
  })

  it('should revert when payment is below required payment', async function () {
    const INSUFFICIENT_PAYMENT = PAYMENT / 2
    await this.crowdsaleFactory.createCrowdsale(
      TOKEN_NAME, TOKEN_SYMBOL, [RATE], [this.openingTime], this.closingTime, GOAL, CAP, wallet, { from: crowdsaleCreator, value: INSUFFICIENT_PAYMENT }
    ).should.be.rejectedWith(EVMRevert);
  })

  it('should allow withdraw of payments', async function () {
    let initialBalance = web3.eth.getBalance(factoryOwner)

    await this.crowdsaleFactory.createCrowdsale(
      TOKEN_NAME, TOKEN_SYMBOL, [RATE], [this.openingTime], this.closingTime, GOAL, CAP, wallet, { from: crowdsaleCreator, value: PAYMENT }
    )
    expect(await this.crowdsaleFactory.payments(factoryOwner)).to.be.bignumber.equal(PAYMENT)
    expect(await this.crowdsaleFactory.totalPayments()).to.be.bignumber.equal(PAYMENT)

    await this.crowdsaleFactory.withdrawPayments({ from: factoryOwner })
    expect(await this.crowdsaleFactory.payments(factoryOwner)).to.be.bignumber.equal(0)
    expect(await this.crowdsaleFactory.totalPayments()).to.be.bignumber.equal(0)

    let balance = web3.eth.getBalance(factoryOwner)
    assert(Math.abs(balance - initialBalance - PAYMENT) < 1e16);
  })

  it('owner can reset cost', async function () {
    const newCost = ether(10)
    this.crowdsaleFactory.setCost(newCost, { from: factoryOwner })
    expect(await this.crowdsaleFactory.cost()).to.be.bignumber.equal(newCost)
  })

  it('non-owner cannot reset cost', async function () {
    const newCost = ether(10)
    await this.crowdsaleFactory.setCost(newCost, { from: notFactoryOwner }).should.be.rejectedWith(EVMRevert);
  })
});
