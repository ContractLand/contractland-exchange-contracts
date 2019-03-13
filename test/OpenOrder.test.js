const TestOpenOrder = artifacts.require("TestOpenOrder")

contract('OpenOrder',  async(accounts) => {
  let openOrderTest;
  const GET_ORDERS_LIMIT_DEFAULT = 10

  beforeEach(async () => {
    openOrderTest = await TestOpenOrder.new()
  })

  describe("Adding orders", async() => {
    const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, timestamp: 1}
    const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, timestamp: 2}
    const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, timestamp: 3}

    beforeEach(async () => {
      await openOrderTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.timestamp).should.be.fulfilled
      await openOrderTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.timestamp).should.be.fulfilled
      await openOrderTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.timestamp).should.be.fulfilled
    })

    it("should add new order to end of list", async() => {
      await checkOrders([order1, order2, order3], GET_ORDERS_LIMIT_DEFAULT)
    })

    describe("Updating order", async() => {
      it("should update order amount", async() => {
        const newAmount = 5
        await openOrderTest.update(order1.id, newAmount).should.be.fulfilled

        await checkOrders([
          {id: order1.id, price: order1.price, originalAmount: order1.originalAmount, amount: newAmount, isSell: order1.isSell, timestamp: order1.timestamp},
          order2,
          order3
        ], GET_ORDERS_LIMIT_DEFAULT)
      })

      it("should do nothing if order does not exist", async() => {
        await openOrderTest.update(4, 100).should.be.fulfilled

        await checkOrders([
          order1,
          order2,
          order3
        ], GET_ORDERS_LIMIT_DEFAULT)
      })
    })

    describe("Removing order", async() => {
      it("should remove order from middle list", async() => {
        await openOrderTest.remove(order2.id).should.be.fulfilled

        await checkOrders([
          order1,
          order3
        ], GET_ORDERS_LIMIT_DEFAULT)
      })

      it("should remove order from beginning of list", async() => {
        await openOrderTest.remove(order1.id).should.be.fulfilled

        await checkOrders([
          order3,
          order2
        ], GET_ORDERS_LIMIT_DEFAULT)
      })

      it("should remove order from end of list", async() => {
        await openOrderTest.remove(order3.id).should.be.fulfilled

        await checkOrders([
          order1,
          order2
        ], GET_ORDERS_LIMIT_DEFAULT)
      })

      it("should be able to remove all orders from list oldest to newest", async() => {
        await openOrderTest.remove(order1.id).should.be.fulfilled
        await openOrderTest.remove(order2.id).should.be.fulfilled
        await openOrderTest.remove(order3.id).should.be.fulfilled

        const actualOrders = await openOrderTest.getOrders(GET_ORDERS_LIMIT_DEFAULT)
        const emptyOrders = [ [], [], [], [], [], [] ]
        assert.deepEqual(actualOrders, emptyOrders)
      })

      it("should be able to remove all orders from list newest to oldest", async() => {
        await openOrderTest.remove(order3.id).should.be.fulfilled
        await openOrderTest.remove(order2.id).should.be.fulfilled
        await openOrderTest.remove(order1.id).should.be.fulfilled

        const actualOrders = await openOrderTest.getOrders(GET_ORDERS_LIMIT_DEFAULT)
        const emptyOrders = [ [], [], [], [], [], [] ]
        assert.deepEqual(actualOrders, emptyOrders)
      })

      it("should do nothing if order does not exist", async() => {
        await openOrderTest.remove(4).should.be.fulfilled

        await checkOrders([
          order1,
          order2,
          order3
        ], GET_ORDERS_LIMIT_DEFAULT)
      })

      it("should do nothing if order is already removed", async() => {
        await openOrderTest.remove(3).should.be.fulfilled
        await openOrderTest.remove(3).should.be.fulfilled

        await checkOrders([
          order1,
          order2
        ], GET_ORDERS_LIMIT_DEFAULT)
      })
    })

    describe("Get Orders", async() => {
      it("should get all orders", async() => {
        await checkOrders([
          order1,
          order2,
          order3
        ], 10)
      })

      it("should not exceed limit", async() => {
        await checkOrders([
          order1,
          order2
        ], 2)
      })
    })
  })

  async function checkOrders(expectedOrders, limit) {
      const result = await openOrderTest.getOrders(limit)
      const actualOrders = parseOrderResult(result)
      assert.equal(actualOrders.id.length, expectedOrders.length)
      for (let i = 0; i < expectedOrders.length; i++) {
          assert.equal(actualOrders.id[i], expectedOrders[i].id)
          assert.equal(actualOrders.price[i], expectedOrders[i].price)
          assert.equal(actualOrders.originalAmount[i], expectedOrders[i].originalAmount)
          assert.equal(actualOrders.amount[i], expectedOrders[i].amount)
          assert.equal(actualOrders.isSell[i], expectedOrders[i].isSell)
          assert.equal(actualOrders.timestamp[i], expectedOrders[i].timestamp)
      }
  }

  function parseOrderResult(result) {
      return {
          id: result[0].map(t => t.toNumber()),
          price: result[1].map(t => t.toNumber()),
          originalAmount: result[2].map(t => t.toNumber()),
          amount: result[3].map(t => t.toNumber()),
          isSell: result[4],
          timestamp: result[5].map(t => t.toNumber())
      }
  }
})
