const CrowdsaleToken = artifacts.require('CrowdsaleToken');

contract('CrowdsaleToken', accounts => {
  const NAME = "some token name";
  const SYMBOL = "STN";

  const creator = accounts[0];

  beforeEach(async function () {
    this.token = await CrowdsaleToken.new(NAME, SYMBOL, { from: creator });
  });

  it('should create token with correct parameters', async function () {
    const name = await this.token.name();
    assert.equal(name, NAME);

    const symbol = await this.token.symbol();
    assert.equal(symbol, SYMBOL);
  });

  it('has 18 decimals', async function () {
    const decimals = await this.token.decimals();
    assert(decimals.eq(18));
  });
});