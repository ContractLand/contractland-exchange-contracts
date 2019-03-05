const TestTradeHistory = artifacts.require("TestTradeHistory")

contract('TradeHistory',  async(accounts) => {
  let tradeHistoryTest;

  beforeEach(async () => {
    tradeHistoryTest = await TestTradeHistory.new()
  })

  describe("Trades", async() => {
    it("should return empty when there are no trades", async() => {
      const actualTrades = await tradeHistoryTest.getTrades()
      const emptyTrades = [ [], [], [], [], [] ]
      assert.deepEqual(actualTrades, emptyTrades)
    })

    it("should append new trade to end of list", async() => {
      const trade1 = {id: 1, price: 1, amount: 1, isSell: false, timestamp: 1}
      const trade2 = {id: 2, price: 2, amount: 2, isSell: true, timestamp: 2}
      const trade3 = {id: 3, price: 3, amount: 3, isSell: true, timestamp: 3}

      tradeHistoryTest.add(trade1.id, trade1.price, trade1.amount, trade1.isSell, trade1.timestamp)
      tradeHistoryTest.add(trade2.id, trade2.price, trade2.amount, trade2.isSell, trade2.timestamp)
      tradeHistoryTest.add(trade3.id, trade3.price, trade3.amount, trade3.isSell, trade3.timestamp)

      await checkTradeHistory([trade3, trade2, trade1])
    })

    it("should consolidate trades with same order id and price", async() => {
      const trade1 = {id: 1, price: 1, amount: 1, isSell: false, timestamp: 1}
      const trade2 = {id: 2, price: 2, amount: 2, isSell: true, timestamp: 2}
      const trade3 = {id: 2, price: 2, amount: 3, isSell: true, timestamp: 3}

      tradeHistoryTest.add(trade1.id, trade1.price, trade1.amount, trade1.isSell, trade1.timestamp)
      tradeHistoryTest.add(trade2.id, trade2.price, trade2.amount, trade2.isSell, trade2.timestamp)
      tradeHistoryTest.add(trade3.id, trade3.price, trade3.amount, trade3.isSell, trade3.timestamp)

      const expectedTrades = [
        {id: 2, price: 2, amount: 5, isSell: true, timestamp: 2},
        trade1
      ]
      await checkTradeHistory(expectedTrades)
    })
  })

  async function checkTradeHistory(expectedTrades) {
      const result = await tradeHistoryTest.getTrades()
      const actualTrades = parseTradeResult(result)
      for (let i = 0; i < expectedTrades.length; i++) {
          assert.equal(actualTrades.id[i], expectedTrades[i].id)
          assert.equal(actualTrades.price[i], expectedTrades[i].price)
          assert.equal(actualTrades.amount[i], expectedTrades[i].amount)
          assert.equal(actualTrades.isSell[i], expectedTrades[i].isSell)
          assert.equal(actualTrades.timestamp[i], expectedTrades[i].timestamp)
      }
  }

  function parseTradeResult(result) {
      return {
          id: result[0].map(t => t.toNumber()),
          price: result[1].map(t => t.toNumber()),
          amount: result[2].map(t => t.toNumber()),
          isSell: result[3],
          timestamp: result[4].map(t => t.toNumber())
      }
  }
})
