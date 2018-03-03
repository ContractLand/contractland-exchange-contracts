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

contract('CrowdsaleFactory', function ([factoryOwner, crowdsaleCreator, wallet, investor]) {
  const TOKEN_NAME = 'Name';
  const TOKEN_SYMBOL = 'Symbol';
  const RATE = new BigNumber(10);
  const GOAL = ether(10);
  const CAP = ether(20);

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);

    this.crowdsaleFactory = await CrowdsaleFactory.new();
    await this.crowdsaleFactory.createCrowdsale(
      TOKEN_NAME, TOKEN_SYMBOL, this.openingTime, this.closingTime, RATE, GOAL, CAP, wallet, { from: crowdsaleCreator }
    );
  });

  it('should create token and crowdsale with correct parameters', async function () {
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
    const crowdsale = SimpleCrowdsale.at(await this.crowdsaleFactory.creatorToCrowdsaleMap(crowdsaleCreator, 0))
    const token = CrowdsaleToken.at(await crowdsale.token())
    expect(await token.owner()).to.equal(crowdsale.address)
  })
});
