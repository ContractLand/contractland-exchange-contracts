const TestBidHeap = artifacts.require("TestBidHeap")

contract.only('BidHeap',  async(accounts) => {
  let heap;
  const EMPTY_NODE = {id: 0, owner: 0, baseToken: 0, tradeToken: 0, price: 0, amount: 0, timestamp: 0}

  beforeEach(async () => {
    heap = await TestBidHeap.new()
  })

  describe("insert", async() => {
    it("should init heap with empty node at index 0", async() => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)

      const result = await heap.peakByIndex.call(0)
      assertNodeEqual(result, EMPTY_NODE)
    })

    it("should insert keys in heap-like fashion", async () => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      const root = await heap.peakByIndex.call(1)
      assertNodeEqual(root, nodes[2])

      const leftChild = await heap.peakByIndex.call(2)
      assertNodeEqual(leftChild, nodes[0])

      const rightChild = await heap.peakByIndex.call(3)
      assertNodeEqual(rightChild, nodes[1])
    })

    it("should handle equal key values", async () => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 1, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 2, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      const root = await heap.peakByIndex.call(1)
      assertNodeEqual(root, nodes[2])

      const leftChild = await heap.peakByIndex.call(2)
      assertNodeEqual(leftChild, nodes[1])

      const rightChild = await heap.peakByIndex.call(3)
      assertNodeEqual(rightChild, nodes[0])
    })
  })

  describe("pop", async() => {
    it("should return empty node if heap is empty", async() => {
      const result = await heap.pop.call()
      assertNodeEqual(result, EMPTY_NODE)
    })

    it("should remove node if heap has single node", async() => {
      const nodes = [{id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 2, timestamp: 3}]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)

      const sizeAfterAdd = await heap.size.call()
      assert.equal(sizeAfterAdd.toNumber(), 1)

      const result = await heap.pop.call()
      assertNodeEqual(result, nodes[0])
      await heap.pop()

      const sizeAfterPop = await heap.size.call()
      assert.equal(sizeAfterPop.toNumber(), 0)
    })

    it("should remove max key nodes from heap", async() => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      const sizeAfterAdd = await heap.size.call()
      assert.equal(sizeAfterAdd.toNumber(), 3)

      let result = await heap.pop.call()
      assertNodeEqual(result, nodes[2])
      await heap.pop()

      result = await heap.pop.call()
      assertNodeEqual(result, nodes[1])
      await heap.pop()

      result = await heap.pop.call()
      assertNodeEqual(result, nodes[0])
      await heap.pop()

      const sizeAfterPop = await heap.size.call()
      assert.equal(sizeAfterPop.toNumber(), 0)
    })
  })

  describe.only("updatePrice", async() => {
    it("should maintain heap order after price increase update", async() => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      nodes[0].price = 101
      await heap.updatePriceById(1, nodes[0].price)

      const root = await heap.peakByIndex.call(1)
      assertNodeEqual(root, nodes[0])

      const leftChild = await heap.peakByIndex.call(2)
      assertNodeEqual(leftChild, nodes[2])

      const rightChild = await heap.peakByIndex.call(3)
      assertNodeEqual(rightChild, nodes[1])
    })

    it("should maintain heap order after price decrease update", async() => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      nodes[2].price = 5
      await heap.updatePriceById(3, nodes[2].price)

      const root = await heap.peakByIndex.call(1)
      assertNodeEqual(root, nodes[1])

      const leftChild = await heap.peakByIndex.call(2)
      assertNodeEqual(leftChild, nodes[0])

      const rightChild = await heap.peakByIndex.call(3)
      assertNodeEqual(rightChild, nodes[2])
    })

    it("should do nothing is newPrice is same", async() => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      await heap.updatePriceById(1, nodes[0].price)
      await heap.updatePriceById(2, nodes[1].price)
      await heap.updatePriceById(3, nodes[2].price)

      const root = await heap.peakByIndex.call(1)
      assertNodeEqual(root, nodes[2])

      const leftChild = await heap.peakByIndex.call(2)
      assertNodeEqual(leftChild, nodes[0])

      const rightChild = await heap.peakByIndex.call(3)
      assertNodeEqual(rightChild, nodes[1])
    })
  })

  describe("removeById", async() => {
    it("should extract node by unique id", async () => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 0, timestamp: 0},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 0, timestamp: 0},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 0, timestamp: 0}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      await heap.removeById(2)

      const result = await heap.peakById.call(2)
      assertNodeEqual(result, EMPTY_NODE)
    })
  })

  describe("peak", async() => {
    it("should return root of heap", async () => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 2, timestamp: 3},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 20, timestamp: 30},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 200, timestamp: 300}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      const result = await heap.peak.call()
      assertNodeEqual(result, nodes[2])
    })
  })

  describe("peakById", async() => {
    it("should find node by unique id", async () => {
      const nodes = [
        {id: 1, owner: accounts[0], baseToken: accounts[1], tradeToken: accounts[2], price: 1, amount: 2, timestamp: 3},
        {id: 2, owner: accounts[3], baseToken: accounts[4], tradeToken: accounts[5], price: 10, amount: 20, timestamp: 30},
        {id: 3, owner: accounts[6], baseToken: accounts[7], tradeToken: accounts[8], price: 100, amount: 200, timestamp: 300}
      ]

      await heap.add(nodes[0].id, nodes[0].owner, nodes[0].baseToken, nodes[0].tradeToken, nodes[0].price, nodes[0].amount, nodes[0].timestamp)
      await heap.add(nodes[1].id, nodes[1].owner, nodes[1].baseToken, nodes[1].tradeToken, nodes[1].price, nodes[1].amount, nodes[1].timestamp)
      await heap.add(nodes[2].id, nodes[2].owner, nodes[2].baseToken, nodes[2].tradeToken, nodes[2].price, nodes[2].amount, nodes[2].timestamp)

      const result = await heap.peakById.call(2)
      assertNodeEqual(result, nodes[1])
    })
  })

  it.skip("fuzzy test", async() => {
    const testSize = 100
    let max, oldMax, size

    let vals = Array.from({length: testSize}, () => Math.floor(Math.random() * 100000))

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)

    for (let i = 0; i < vals.length; i++) {
      await heap.add(0, 0, 0, 0, vals[i], 0, 0)
    }

    size = await heap.size.call()
    assert.equal(size.toNumber(), testSize)

    max = await heap.peak.call()
    assert.equal(max[4].toNumber(), Math.max(...vals.slice(0,testSize-1)))

    for (let i = 0; i < vals.length; i++) {
      await heap.pop()
      oldMax = max
      max = await heap.peak.call()
      assert.isTrue(oldMax[4].toNumber() >= (max[4]).toNumber())
    }

    size = await heap.size.call()
    assert.equal(size.toNumber(), 0)
  })

  function assertNodeEqual(actualNode, expectedNode) {
    assert.equal(actualNode[0].toNumber(), expectedNode.id)
    assert.equal(actualNode[1], expectedNode.owner)
    assert.equal(actualNode[2], expectedNode.baseToken)
    assert.equal(actualNode[3], expectedNode.tradeToken)
    assert.equal(actualNode[4].toNumber(), expectedNode.price)
    assert.equal(actualNode[5].toNumber(), expectedNode.amount)
    assert.equal(actualNode[6].toNumber(), expectedNode.timestamp)
  }
})
