import EVMRevert from './helpers/EVMRevert'

const MockManageable = artifacts.require('MockManageable')

contract('Manageable', ([owner, manager, newManager, nonOwner, nonManager]) => {
  beforeEach(async function () {
    this.manageable = await MockManageable.new(manager, {from: owner})
  })

  it('should assign ownership to creator', async function () {
    expect(await this.manageable.owner()).equal(owner)
  })

  it('should assign manager on construction', async function () {
    expect(await this.manageable.manager()).equal(manager)
  })

  it('only owner can reassign management', async function () {
    await this.manageable.updateManager(newManager, {from: nonOwner}).should.be.rejectedWith(EVMRevert)

    await this.manageable.updateManager(newManager, {from: owner})
    expect(await this.manageable.manager()).equal(newManager)
  })

  it('only manager can call managed functions', async function () {
    await this.manageable.managedFunction({from: nonManager}).should.be.rejectedWith(EVMRevert)
    await this.manageable.managedFunction({from: manager}).should.not.be.rejectedWith(EVMRevert)
  })
})
