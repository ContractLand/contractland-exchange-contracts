const TestOrderBookHeap = artifacts.require("TestOrderBookHeap")

contract.only('OrderBookHeap',  async(accounts) => {
  it("should be heap-like", async() => {
    const testSize = 100
    let heap, max, oldMax, size

    heap = await TestOrderBookHeap.new()

    let vals = Array.from({length: testSize}, () => Math.floor(Math.random() * 100000))

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)

    for (let i = 0; i < vals.length; i++) {
      await heap.insert.sendTransaction(0, 0, 0, 0, vals[i], 0, 0, {from: accounts[0]})
    }

    max = await heap.getMax.call({to: heap.address})
    assert.equal(max[4], Math.max(...vals.slice(0,testSize-1)))

    for (let i = 0; i < vals.length; i++) {
      await heap.extractMax.sendTransaction({from: accounts[0]})
      oldMax = max
      max = await heap.getMax.call({to: heap.address})
      assert.isTrue(oldMax[4].toNumber() >= (max[4]).toNumber())
    }

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)
  })
})
