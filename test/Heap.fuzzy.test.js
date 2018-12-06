const TestAskHeap = artifacts.require("TestAskHeap")
const TestBidHeap = artifacts.require("TestBidHeap")

contract('Heap Fuzzy Test',  async(accounts) => {
  const TEST_SIZE = 100

  it("AskHeap", async() => {
    const askHeap = await TestAskHeap.new()
    let min, oldMin, size

    let vals = Array.from({length: TEST_SIZE}, () => Math.floor(Math.random() * 100000))

    size = await askHeap.size.call()
    assert.equal(size.toNumber(), 0)

    for (let i = 0; i < vals.length; i++) {
      await askHeap.add(0, 0, 0, 0, vals[i], 0, 0)
    }

    size = await askHeap.size.call()
    assert.equal(size.toNumber(), TEST_SIZE)

    min = await askHeap.peak.call()
    assert.equal(min[4].toNumber(), Math.min(...vals.slice(0,TEST_SIZE-1)))

    for (let i = 1; i < vals.length; i++) {
      await askHeap.pop()
      oldMin = min
      min = await askHeap.peak.call()
      assert.isTrue(oldMin[4].toNumber() <= min[4].toNumber())
    }

    size = await askHeap.size.call()
    assert.equal(size.toNumber(), 1)
  })

  it("BidHeap", async() => {
    const bidHeap = await TestBidHeap.new()
    let max, oldMax, size

    let vals = Array.from({length: TEST_SIZE}, () => Math.floor(Math.random() * 100000))

    size = await bidHeap.size.call()
    assert.equal(size.toNumber(), 0)

    for (let i = 0; i < vals.length; i++) {
      await bidHeap.add(0, 0, 0, 0, vals[i], 0, 0)
    }

    size = await bidHeap.size.call()
    assert.equal(size.toNumber(), TEST_SIZE)

    max = await bidHeap.peak.call()
    assert.equal(max[4].toNumber(), Math.max(...vals.slice(0,TEST_SIZE-1)))

    for (let i = 0; i < vals.length; i++) {
      await bidHeap.pop()
      oldMax = max
      max = await bidHeap.peak.call()
      assert.isTrue(oldMax[4].toNumber() >= max[4].toNumber())
    }

    size = await bidHeap.size.call()
    assert.equal(size.toNumber(), 0)
  })
})
