const TestAskHeap = artifacts.require("TestAskHeap")

contract('AskHeap',  async(accounts) => {
  let heap;

  beforeEach(async () => {
    heap = await TestAskHeap.new()
  })

  it("should be min-heap-like", async() => {
    const testSize = 100
    let min, oldMin, size

    let vals = Array.from({length: testSize}, () => Math.floor(Math.random() * 100000))

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)

    for (let i = 0; i < vals.length; i++) {
      await heap.insert.sendTransaction(0, 0, 0, 0, vals[i], 0, 0, {from: accounts[0]})
    }

    min = await heap.getMin.call()
    assert.equal(min[4], Math.min(...vals.slice(0,testSize-1)))

    for (let i = 0; i < vals.length; i++) {
      await heap.extractMin.sendTransaction({from: accounts[0]})
      oldMin = min
      min = await heap.getMin.call()
      assert.isTrue(oldMin[4].toNumber() >= (min[4]).toNumber())
    }

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)
  })

  it("should find node by unique id", async () => {
    let nodes = [
      {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 2, timestamp: 3},
      {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 20, timestamp: 30},
      {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 200, timestamp: 300}
    ]

    await heap.insert.sendTransaction(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp, {from: accounts[0]})
    await heap.insert.sendTransaction(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp, {from: accounts[0]})
    await heap.insert.sendTransaction(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp, {from: accounts[0]})

    let result = await heap.getById.call(2)
    assert.equal(result[0], nodes[1].id)
    assert.equal(result[1], nodes[1].owner)
    assert.equal(result[2], nodes[1].baseToken)
    assert.equal(result[3], nodes[1].tradeToken)
    assert.equal(result[4], nodes[1].price)
    assert.equal(result[5], nodes[1].amount)
    assert.equal(result[6], nodes[1].timestamp)
  })

  it("should extract node by unique id", async () => {
    let nodes = [
      {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 2, timestamp: 3},
      {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 20, timestamp: 30},
      {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 200, timestamp: 300}
    ]

    await heap.insert.sendTransaction(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp, {from: accounts[0]})
    await heap.insert.sendTransaction(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp, {from: accounts[0]})
    await heap.insert.sendTransaction(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp, {from: accounts[0]})

    await heap.extractById.sendTransaction(2)

    let result = await heap.getById.call(2)
    assert.equal(result[0], 0)
  })
})
