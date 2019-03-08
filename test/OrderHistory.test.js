const TestOrderHistory = artifacts.require("TestOrderHistory")

contract('OrderHistory',  async(accounts) => {
  let orderHistoryTest;
  const GET_ORDERS_LIMIT_DEFAULT = 10
  const TIME_RANGE_DEFAULT = [0, 10]

  beforeEach(async () => {
    orderHistoryTest = await TestOrderHistory.new()
  })

  describe("Add", async() => {
    it("should return empty when there are no orders", async() => {
      const actualOrders = await orderHistoryTest.getOrders(TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
      const emptyOrders = [ [], [], [], [], [], [], [] ]
      assert.deepEqual(actualOrders, emptyOrders)
    })

    it("should append new order to end of list", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      await checkOrders([order3, order2, order1], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })
  })

  describe("UpdateAmount", async() => {
    it("should update order amount by order id", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const newAmount = 5
      await orderHistoryTest.updateAmount(order2.id, newAmount).should.be.fulfilled

      await checkOrders([
        order3,
        {id: order2.id, price: order2.price, originalAmount: order2.originalAmount, amount: newAmount, isSell: order2.isSell, isActive: order2.isActive, timestamp: order2.timestamp},
        order1
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should fail siliently if order does not exist", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const unknownId = 4
      await orderHistoryTest.updateAmount(unknownId, 10).should.be.fulfilled

      await checkOrders([
        order3,
        order2,
        order1
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should update first order in list", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const newAmount = 5
      await orderHistoryTest.updateAmount(order1.id, 5).should.be.fulfilled

      await checkOrders([
        order3,
        order2,
        {id: order1.id, price: order1.price, originalAmount: order1.originalAmount, amount: newAmount, isSell: order1.isSell, isActive: order1.isActive, timestamp: order1.timestamp},
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })
  })

  describe("MarkInactive", async() => {
    it("should mark order inactive by order id", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: true, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      await orderHistoryTest.markInactive(order2.id).should.be.fulfilled

      await checkOrders([
        order3,
        {id: order2.id, price: order2.price, originalAmount: order2.originalAmount, amount: order2.amount, isSell: order2.isSell, isActive: false, timestamp: order2.timestamp},
        order1
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should fail siliently if order does not exist", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: true, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const unknownId = 4
      await orderHistoryTest.markInactive(unknownId).should.be.fulfilled

      await checkOrders([
        order3,
        order2,
        order1
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should mark first order inactive in list", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: true, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: true, isActive: true, timestamp: 3}
      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      await orderHistoryTest.markInactive(order1.id).should.be.fulfilled

      await checkOrders([
        order3,
        order2,
        {id: order1.id, price: order1.price, originalAmount: order1.originalAmount, amount: order1.amount, isSell: order1.isSell, isActive: false, timestamp: order1.timestamp},
      ], TIME_RANGE_DEFAULT, GET_ORDERS_LIMIT_DEFAULT)
    })
  })

  describe("GetOrders", async() => {
    it("should not exceed limit", async() => {
      const order = {price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}

      await orderHistoryTest.add(1, order.price, order.originalAmount, order.amount, order.isSell, order.isActive, order.timestamp).should.be.fulfilled
      await orderHistoryTest.add(2, order.price, order.originalAmount, order.amount, order.isSell, order.isActive, order.timestamp).should.be.fulfilled
      await orderHistoryTest.add(3, order.price, order.originalAmount, order.amount, order.isSell, order.isActive, order.timestamp).should.be.fulfilled

      const expectedOrders = [
        {id: 3, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1},
        {id: 2, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      ]

      await checkOrders(expectedOrders, TIME_RANGE_DEFAULT, 2)
    })

    it("should return empty if startEnd is greater than endTime", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled

      const actualOrders = await orderHistoryTest.getOrders([1,0], GET_ORDERS_LIMIT_DEFAULT)
      const emptyOrders = [ [], [], [], [], [], [], [] ]
      assert.deepEqual(actualOrders, emptyOrders)
    })

    it("should return empty if startTime is equal to endTime", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled

      const actualOrders = await orderHistoryTest.getOrders([1,1], GET_ORDERS_LIMIT_DEFAULT)
      const emptyOrders = [ [], [], [], [], [], [], [] ]
      assert.deepEqual(actualOrders, emptyOrders)
    })

    it("should return all orders up to endTime when startTime == 0", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: false, isActive: false, timestamp: 3}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const expectedOrders = [
        order2,
        order1
      ]
      await checkOrders(expectedOrders, [0,2], GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should return all orders from startTime when endTime > latest", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: false, isActive: false, timestamp: 3}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled

      const expectedOrders = [
        order3,
        order2,
        order1
      ]
      await checkOrders(expectedOrders, [1,4], GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should return all orders within time range when endTime and startTime are found", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order2 = {id: 2, price: 2, originalAmount: 2, amount: 2, isSell: true, isActive: true, timestamp: 2}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: false, isActive: false, timestamp: 3}
      const order4 = {id: 4, price: 4, originalAmount: 4, amount: 4, isSell: true, isActive: true, timestamp: 4}
      const order5 = {id: 5, price: 5, originalAmount: 5, amount: 5, isSell: true, isActive: true, timestamp: 5}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order2.id, order2.price, order2.originalAmount, order2.amount, order2.isSell, order2.isActive, order2.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order4.id, order4.price, order4.originalAmount, order4.amount, order4.isSell, order4.isActive, order4.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order5.id, order5.price, order5.originalAmount, order5.amount, order5.isSell, order5.isActive, order5.timestamp).should.be.fulfilled

      const expectedOrders = [
        order4,
        order3,
        order2
      ]
      await checkOrders(expectedOrders, [2,4], GET_ORDERS_LIMIT_DEFAULT)
    })

    it("should return all orders within time range when endTime and startTime are not found", async() => {
      const order1 = {id: 1, price: 1, originalAmount: 1, amount: 1, isSell: false, isActive: false, timestamp: 1}
      const order3 = {id: 3, price: 3, originalAmount: 3, amount: 3, isSell: false, isActive: false, timestamp: 3}
      const order4 = {id: 4, price: 4, originalAmount: 4, amount: 4, isSell: true, isActive: true, timestamp: 4}
      const order6 = {id: 6, price: 6, originalAmount: 6, amount: 6, isSell: true, isActive: true, timestamp: 6}

      await orderHistoryTest.add(order1.id, order1.price, order1.originalAmount, order1.amount, order1.isSell, order1.isActive, order1.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order3.id, order3.price, order3.originalAmount, order3.amount, order3.isSell, order3.isActive, order3.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order4.id, order4.price, order4.originalAmount, order4.amount, order4.isSell, order4.isActive, order4.timestamp).should.be.fulfilled
      await orderHistoryTest.add(order6.id, order6.price, order6.originalAmount, order6.amount, order6.isSell, order6.isActive, order6.timestamp).should.be.fulfilled

      const expectedOrders = [
        order4,
        order3
      ]
      await checkOrders(expectedOrders, [2,5], GET_ORDERS_LIMIT_DEFAULT)
    })
  })

  async function checkOrders(expectedOrders, timeRange, limit) {
      const result = await orderHistoryTest.getOrders(timeRange, limit)
      const actualOrders = parseOrderResult(result)
      assert.equal(actualOrders.id.length, expectedOrders.length)
      for (let i = 0; i < expectedOrders.length; i++) {
          assert.equal(actualOrders.id[i], expectedOrders[i].id)
          assert.equal(actualOrders.price[i], expectedOrders[i].price)
          assert.equal(actualOrders.originalAmount[i], expectedOrders[i].originalAmount)
          assert.equal(actualOrders.amount[i], expectedOrders[i].amount)
          assert.equal(actualOrders.isSell[i], expectedOrders[i].isSell)
          assert.equal(actualOrders.isActive[i], expectedOrders[i].isActive)
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
          isActive: result[5],
          timestamp: result[6].map(t => t.toNumber())
      }
  }
})
