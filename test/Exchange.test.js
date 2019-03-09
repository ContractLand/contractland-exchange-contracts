import { expect } from 'chai'
import EVMRevert from './helpers/EVMRevert'
import toWei from './helpers/toWei'
import fromWei from './helpers/fromWei'
import time from './helpers/time'

require('chai')
  .use(require('chai-as-promised'))
  .should()

const Exchange = artifacts.require("./Exchange.sol");
const ExchangeProxy = artifacts.require('AdminUpgradeabilityProxy')
const Token = artifacts.require("./TestToken.sol");
const FallbackTrap = artifacts.require("./FallbackTrap.sol");

contract("Exchange", () => {
    const [deployer, buyer, seller, proxyOwner, exchangeOwner, notExchangeOwner] = web3.eth.accounts;
    let exchange, exchangeProxy, baseToken, tradeToken, orderId, fallbackTrap;
    const etherAddress = '0x0000000000000000000000000000000000000000'
    const invalidToken = '0x1111111111111111111111111111111111111111'
    const MIN_PRICE_SIZE = toWei(0.00000001)
    const MIN_AMOUNT_SIZE = toWei(0.0001)
    const MAX_TOTAL_SIZE = toWei(1000000000)
    const MAX_GET_RETURN_SIZE = 3
    const DEFAULT_GET_TIME_RANGE = [0, 9999999999999]
    const tokenDepositAmount = MAX_TOTAL_SIZE.times(2);

    beforeEach(async () => {
        orderId = 1;
        await deployExchange()
        await deployFallbackTrap()
        await initBalances()
    })

    describe("Order Insertion", function() {
        it("should be able to create sell order with ether", async () => {
          const sellerEtherBalanceBefore = await web3.eth.getBalance(seller)
          const exchangeEtherBalanceBefore = await web3.eth.getBalance(exchange.address)

          const order = {
            'baseToken': baseToken.address,
            'tradeToken': etherAddress,
            'amount': toWei(1),
            'price': toWei(5),
            'from': seller
          }

          await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, { from: order.from, value: order.amount, gasPrice: 0 }).should.be.fulfilled

          const expectedSellerEtherBalance = sellerEtherBalanceBefore.minus(order.amount)
          const expectedExchangeEtherBalance = exchangeEtherBalanceBefore.plus(order.amount)

          assert.equal(expectedSellerEtherBalance.toString(), (await web3.eth.getBalance(seller)).toString())
          assert.equal(expectedExchangeEtherBalance.toString(), (await web3.eth.getBalance(exchange.address)).toString())
        })

        it("should be able to create buy order with ether", async () => {
          const price = 5
          const buyerEtherBalanceBefore = await web3.eth.getBalance(buyer)
          const exchangeEtherBalanceBefore = await web3.eth.getBalance(exchange.address)

          const order = {
            'baseToken': etherAddress,
            'tradeToken': tradeToken.address,
            'amount': toWei(1),
            'price': toWei(price),
            'from': buyer
          }

          await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, { from: order.from, value: order.amount * price, gasPrice: 0 }).should.be.fulfilled

          const expectedBuyerEtherBalance = buyerEtherBalanceBefore.minus(order.amount * price)
          const expectedExchangeEtherBalance = exchangeEtherBalanceBefore.plus(order.amount * price)

          assert.equal(expectedBuyerEtherBalance.toString(), (await web3.eth.getBalance(buyer)).toString())
          assert.equal(expectedExchangeEtherBalance.toString(), (await web3.eth.getBalance(exchange.address)).toString())
        })

        it("should not be able to create buy order with same baseToken and tradeToken", async () => {
          const order = {
            'baseToken': baseToken.address,
            'tradeToken': baseToken.address,
            'amount': toWei(1),
            'price': toWei(5),
            'from': buyer
          }

          await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
          await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with same baseToken and tradeToken", async () => {
          const order = {
            'baseToken': tradeToken.address,
            'tradeToken': tradeToken.address,
            'amount': toWei(1),
            'price': toWei(5),
            'from': seller
          }

          await tradeToken.approve(exchange.address, order.amount, { from: order.from })
          await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order without sufficient baseToken", async () => {
            const order = {
              'baseToken': invalidToken,
              'tradeToken': tradeToken.address,
              'amount': toWei(1),
              'price': toWei(5),
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order without sufficient tradeToken", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': invalidToken,
              'amount': toWei(1),
              'price': toWei(5),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with price less than MIN_PRICE_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': toWei(10000),
              'price': MIN_PRICE_SIZE.minus(1),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with price less than MIN_PRICE_SIZE", async () => {
          const order = {
            'baseToken': baseToken.address,
            'tradeToken': tradeToken.address,
            'amount': toWei(10000),
            'price': MIN_PRICE_SIZE.minus(1),
            'from': buyer
          }

          await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
          await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with total amount greater than MAX_TOTAL_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MAX_TOTAL_SIZE.plus(1),
              'price': 1,
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with total amount greater than MAX_TOTAL_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MAX_TOTAL_SIZE.plus(1),
              'price': 1,
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with amount less than MIN_AMOUNT_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MIN_AMOUNT_SIZE.minus(1),
              'price': toWei(1),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with amount less than MIN_AMOUNT_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MIN_AMOUNT_SIZE.minus(1),
              'price': toWei(1),
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with zero amount", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 0,
              'price': toWei(5),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with zero amount", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 0,
              'price': toWei(5),
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with zero price", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 100,
              'price': 0,
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with zero price", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 100,
              'price': 0,
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order where amount * price is zero in solidity", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 1,
              'price': 1,
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order where amount * price is zero in solidity", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': 1,
              'price': 1,
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should disallow cancelling of other people's orders", async function () {
            const buyOrder = buy(100, 5)
            await placeOrder(buyOrder).should.be.fulfilled

            const invalidSender = seller
            await cancelOrder(1, invalidSender).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to cancel orders that does not exist", async function () {
            await cancelOrder(1, seller).should.be.rejectedWith(EVMRevert)
        })

        it("should insert a new buy order as first", () => {
            const order = buy(100, 5)
            const orderbookState = {bestBid: 1, bestAsk: 0}
            const newOrderWatcher = exchange.NewOrder();
            return testOrder(order, orderbookState)
                .then(() => {
                    let eventState = order
                    eventState.id = 1
                    checkNewOrderEvent(newOrderWatcher, eventState)
                })
                .then(() => checkBalance(baseToken.address, order.from, {available: tokenDepositAmount - order.total, reserved: order.total}))
        });

        it("should insert a new sell order as first", () => {
            const order = sell(100, 5)
            const orderbookState = {bestBid: 0, bestAsk: 1}
            const newOrderWatcher = exchange.NewOrder()
            return testOrder(order, orderbookState)
                .then(() => {
                    let eventState = order;
                    eventState.id = 1;
                    checkNewOrderEvent(newOrderWatcher, eventState)
                })
                .then(() => checkBalance(tradeToken.address, order.from, {available: tokenDepositAmount - order.amount, reserved: order.amount}))
        });

        it("should cancel the last single buy order", () => {
            const order = buy(100, 5);
            let orderId;
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(order)
                .then(id => orderId = id)
                .then(() => cancelOrder(orderId, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: orderId, baseToken: baseToken.address, tradeToken: tradeToken.address, owner: buyer, sell: order.sell, price: order.price, amount: order.amount}))
                .then(() => checkOrder(orderId, undefined))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}))
                .then(() => checkBalance(baseToken.address, order.from, {available: tokenDepositAmount, reserved: 0}));
        });

        it("should cancel the last single sell order", () => {
            const order = sell(100, 5);
            let orderId;
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(order)
                .then(id => orderId = id)
                .then(() => cancelOrder(orderId, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: orderId, baseToken: baseToken.address, tradeToken: tradeToken.address, owner: seller, sell: order.sell, price: order.price, amount: order.amount}))
                .then(() => checkOrder(orderId, undefined))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}))
                .then(() => checkBalance(tradeToken.address, order.from, {available: tokenDepositAmount, reserved: 0}));
        });

        it("should insert a new sell order and update the best ask reference", () => {
            const order = sell(100, 5);
            const orderbookState = {bestBid: 0, bestAsk: 2};
            return placeOrder(sell(110, 5))
                .then(() => testOrder(order, orderbookState))
        });

        it("should insert a new buy order and update the best bid reference", () => {
            const order = buy(110, 5);
            const orderbookState = {bestBid: 2, bestAsk: 0};
            return placeOrder(buy(100, 5))
                .then(() => testOrder(order, orderbookState))
        });

        it("should insert a new buy order behind best bid orders", () => {
            const order = buy(50, 5);
            const orderbookState = {bestBid: 1, bestAsk: 0};
            return placeOrder(buy(100, 5))
                .then(() => testOrder(order, orderbookState))
        });

        it("should insert a new sell order behind best ask orders", () => {
            const order = sell(100, 5);
            const orderbookState = {bestBid: 0, bestAsk: 1};
            return placeOrder(sell(50, 5))
                .then(() => testOrder(order, orderbookState))
        });

        it("should cancel a sell order from the middle of sell orders", () => {
            const order1 = sell(100, 5)
            const order2 = sell(110, 5)
            const order3 = sell(120, 5)
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(order1)
                .then(() => placeOrder(order2))
                .then(() => placeOrder(order3))
                .then(() => cancelOrder(2, order2.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: 2, baseToken: baseToken.address, tradeToken: tradeToken.address, owner: seller, sell: order2.sell, price: order2.price, amount: order2.amount}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {price: order1.price, amount: order1.amount}))
                .then(() => checkOrder(3, {price: order3.price, amount: order3.amount}))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 1}))
        });

        it("should cancel a buy order from the middle of buy orders", () => {
            const order1 = buy(100, 5)
            const order2 = buy(110, 5)
            const order3 = buy(120, 5)
            const cancelOrderWatcher = exchange.NewCancelOrder();

            return placeOrder(order1)
                .then(() => placeOrder(order2))
                .then(() => placeOrder(order3))
                .then(() => cancelOrder(2, order2.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: 2, baseToken: baseToken.address, tradeToken: tradeToken.address, owner: buyer, sell: order2.sell, price: order2.price, amount: order2.amount}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {price: order1.price, amount: order1.amount}))
                .then(() => checkOrder(3, {price: order3.price, amount: order3.amount}))
                .then(() => checkOrderbook({bestBid: 3, bestAsk: 0}));
        });

        it("should determine correct best bid after adding different orders", () => {
            let bestBid;
            let bestBidPrice
            return placeOrder(buy(2, 1))
                .then(() => placeOrder(buy(3, 1)))
                .then(() => placeOrder(buy(4, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestBid = orderbook[1].toFixed()}))
                .then(() => exchange.getOrder(bestBid).then(order => {bestBidPrice = order[3].toFixed()}))
                .then(() => assert.equal(bestBidPrice, 4000000000000000000))
        });

        it("should determine correct best bid after adding identical orders", () => {
            let bestBid;
            let bestBidPrice
            return placeOrder(buy(2, 1))
                .then(() => placeOrder(buy(2, 1)))
                .then(() => placeOrder(buy(4, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestBid = orderbook[1].toFixed()}))
                .then(() => exchange.getOrder(bestBid).then(order => {bestBidPrice = order[3].toFixed()}))
                .then(() => assert.equal(bestBidPrice, 4000000000000000000))
        });

        it("should determine correct best ask after adding different orders", () => {
            let bestAsk;
            let bestAskPrice
            return placeOrder(sell(4, 1))
                .then(() => placeOrder(sell(3, 1)))
                .then(() => placeOrder(sell(2, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestAsk = orderbook[0].toFixed()}))
                .then(() => exchange.getOrder(bestAsk).then(order => {bestAskPrice = order[3].toFixed()}))
                .then(() => assert.equal(bestAskPrice, 2000000000000000000))
        });

        it("should determine correct best ask after adding identical orders", () => {
            let bestAsk;
            let bestAskPrice
            return placeOrder(sell(4, 1))
                .then(() => placeOrder(sell(4, 1)))
                .then(() => placeOrder(sell(2, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestAsk = orderbook[0].toFixed()}))
                .then(() => exchange.getOrder(bestAsk).then(order => {bestAskPrice = order[3].toFixed()}))
                .then(() => assert.equal(bestAskPrice, 2000000000000000000))
        });
    });

    describe("Order Matching", function() {
        it("the best buy order should be partially filled by a new sell order", () => {
            const buyOrder = buy(100, 5);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{makeOrderId: 1, takeOrderId: 2, taker: seller, maker: buyer, isSell: true, amount: sellOrder.amount, price: buyOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {amount: buyOrder.amount - sellOrder.amount}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: sellOrder.amount * fromWei(buyOrder.price), reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount - buyOrder.total,
                        reserved: fromWei(buyOrder.price) * (buyOrder.amount - sellOrder.amount)
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 1, bestAsk: 0}));
        });

        it("the best sell order should be partially filled by a new buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 5);
            const tradeEventsStates = [{takeOrderId: 2, makeOrderId: 1, taker: buyer, maker: seller, isSell: false, amount: buyOrder.amount, price: sellOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {amount: sellOrder.amount - buyOrder.amount}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {
                        available: tokenDepositAmount - sellOrder.amount,
                        reserved: sellOrder.amount - buyOrder.amount
                    }))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: buyOrder.amount * fromWei(sellOrder.price), reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: buyOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount - fromWei(sellOrder.price) * buyOrder.amount,
                        reserved: 0
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 1}));
        });

        it("a new sell order should be partially filled by the best buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 5);
            const tradeEventsStates = [{makeOrderId: 1, takeOrderId: 2, taker: seller, maker: buyer, isSell: true, amount: buyOrder.amount, price: buyOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, {amount: sellOrder.amount - buyOrder.amount}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: sellOrder.amount - buyOrder.amount}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: buyOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: buyOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {available: tokenDepositAmount - buyOrder.total, reserved: 0}))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 2}));
        });

        it("a new buy order should be partially filled by the best sell order", () => {
            const buyOrder = buy(100, 5);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{takeOrderId: 2, makeOrderId: 1, isSell: false, taker: buyer, maker: seller, amount: sellOrder.amount, price: sellOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, {amount: buyOrder.amount - sellOrder.amount}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: sellOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount - buyOrder.total + fromWei(buyOrder.price.minus(sellOrder.price)) * sellOrder.amount,
                        reserved: fromWei(buyOrder.price) * (buyOrder.amount - sellOrder.amount)
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 2, bestAsk: 0}));
        });

        it("a new sell order should be completely filled and completely fill the best buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{makeOrderId: 1, takeOrderId: 2, isSell: true, taker: seller, maker: buyer, amount: sellOrder.amount, price: buyOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, undefined))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: buyOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: buyOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {available: tokenDepositAmount - buyOrder.total, reserved: 0}))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}));
        });

        it("a new buy order should be completely filled and completely fill the best sell order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{takeOrderId: 2, makeOrderId: 1, isSell: false, taker: buyer, maker: seller, amount: sellOrder.amount, price: sellOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, undefined))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: sellOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {available: tokenDepositAmount - sellOrder.total, reserved: 0}))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}));
        });

        it("a new sell order should completely fill several buy orders", () => {
            let [buy1, buy2, buy3] = [buy(100, 2), buy(110, 3), buy(120, 4)]
            const sellOrder = sell(105, 10);
            const tradeEventsStates = [
                {makeOrderId: 3, takeOrderId: 4, isSell: true, taker: seller, maker: buyer, amount: buy3.amount, price: buy3.price},
                {makeOrderId: 2, takeOrderId: 4, isSell: true, taker: seller, maker: buyer, amount: buy2.amount, price: buy2.price}
            ];
            const newTradeWatcher = exchange.NewTrade();
            const expectedTokenSoldAmount = buy3.amount.plus(buy2.amount);
            return placeOrder(buy1)
                .then(() => placeOrder(buy2))
                .then(() => placeOrder(buy3))
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(1, {amount: buy1.amount}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(3, undefined))
                .then(() => checkOrder(4, {amount: sellOrder.amount.minus(expectedTokenSoldAmount)}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount.minus(sellOrder.amount), reserved: sellOrder.amount.minus(expectedTokenSoldAmount)}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: buy3.total.plus(buy2.total), reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buy1.from, {available: expectedTokenSoldAmount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buy1.from, {available: tokenDepositAmount.minus(buy3.total.plus(buy2.total.plus(buy1.total))), reserved: buy1.total}))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 1, bestAsk: 4}));
        });

        it("a new buy order should completely fill several sell orders", () => {
            let [sell1, sell2, sell3] = [sell(120, 4), sell(110, 3), sell(100, 2)]
            const buyOrder = buy(115, 10);
            const tradeEventsStates = [
                {takeOrderId: 4, makeOrderId: 3, isSell: false, taker: buyer, maker: seller, amount: sell3.amount, price: sell3.price},
                {takeOrderId: 4, makeOrderId: 2, isSell: false, taker: buyer, maker: seller, amount: sell2.amount, price: sell2.price}
            ];
            const newTradeWatcher = exchange.NewTrade();
            const expectedTokenBoughtAmount = sell3.amount.plus(sell2.amount);
            return placeOrder(sell1)
                .then(() => placeOrder(sell2))
                .then(() => placeOrder(sell3))
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(1, {amount: sell1.amount}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(3, undefined))
                .then(() => checkOrder(4, {amount: buyOrder.amount.minus(expectedTokenBoughtAmount)}))
                .then(() => checkBalance(tradeToken.address, sell1.from, {available: tokenDepositAmount.minus(sell3.amount.plus(sell2.amount.plus(sell1.amount))), reserved: sell1.amount}))
                .then(() => checkBalance(baseToken.address, sell1.from, {available: sell3.total.plus(sell2.total), reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: expectedTokenBoughtAmount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount.minus(sell3.total.plus(sell2.total.plus(fromWei(buyOrder.price).times(buyOrder.amount.minus(expectedTokenBoughtAmount))))),
                        reserved: fromWei(buyOrder.price).times(buyOrder.amount.minus(expectedTokenBoughtAmount))
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({bestBid: 4, bestAsk: 1}));
        });

        it("sell orders should match same priced buy orders in FIFO fashion", () => {
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(90, 5);
            const buyOrderThree = buy(90, 5);
            const sellOrderOne = sell(90, 5);
            const sellOrderTwo = sell(90, 5);
            const sellOrderThree = sell(90, 5);
            const tradeEventsOne = [{makeOrderId: 1, takeOrderId: 4, isSell: true, taker:seller, maker: buyer, amount: buyOrderOne.amount, price: buyOrderOne.price}];
            const tradeEventsTwo = [{makeOrderId: 2, takeOrderId: 5, isSell: true, taker:seller, maker: buyer, amount: buyOrderTwo.amount, price: buyOrderTwo.price}];
            const tradeEventsThree = [{makeOrderId: 3, takeOrderId: 6, isSell: true, taker:seller, maker: buyer, amount: buyOrderThree.amount, price: buyOrderThree.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrderOne)
                .then(() => placeOrder(buyOrderTwo))
                .then(() => placeOrder(buyOrderThree))
                .then(() => checkOrderbook({bestBid: 1, bestAsk: 0}))
                .then(() => placeOrder(sellOrderOne))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsOne))
                .then(() => checkOrderbook({bestBid: 2, bestAsk: 0}))
                .then(() => placeOrder(sellOrderTwo))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsTwo))
                .then(() => checkOrderbook({bestBid: 3, bestAsk: 0}))
                .then(() => placeOrder(sellOrderThree))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsThree))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}))
        })

        it("buy orders should match same priced sell orders in FIFO fashion", () => {
            const sellOrderOne = sell(90, 5);
            const sellOrderTwo = sell(90, 5);
            const sellOrderThree = sell(90, 5);
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(90, 5);
            const buyOrderThree = buy(90, 5);
            const tradeEventsOne = [{takeOrderId: 4, makeOrderId: 1, isSell: false, taker: buyer, maker: seller, amount: sellOrderOne.amount, price: sellOrderOne.price}];
            const tradeEventsTwo = [{takeOrderId: 5, makeOrderId: 2, isSell: false, taker: buyer, maker: seller, amount: sellOrderTwo.amount, price: sellOrderTwo.price}];
            const tradeEventsThree = [{takeOrderId: 6, makeOrderId: 3, isSell: false, taker: buyer, maker: seller, amount: sellOrderThree.amount, price: sellOrderThree.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrderOne)
                .then(() => placeOrder(sellOrderTwo))
                .then(() => placeOrder(sellOrderThree))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 1}))
                .then(() => placeOrder(buyOrderOne))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsOne))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 2}))
                .then(() => placeOrder(buyOrderTwo))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsTwo))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 3}))
                .then(() => placeOrder(buyOrderThree))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsThree))
                .then(() => checkOrderbook({bestBid: 0, bestAsk: 0}))
        })

        it("sell order should match the best priced buy order", () => {
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(95, 5);
            const buyOrderThree = buy(100, 5);
            const sellOrder = sell(80, 2);
            return placeOrder(buyOrderOne)
                .then(() => placeOrder(buyOrderTwo))
                .then(() => placeOrder(buyOrderThree))
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(4, undefined))
                .then(() => checkOrder(3, {amount: buyOrderThree.amount - sellOrder.amount, price: buyOrderThree.price}))
                .then(() => checkOrder(2, {amount: buyOrderTwo.amount, price: buyOrderTwo.price}))
                .then(() => checkOrder(1, {amount: buyOrderOne.amount, price: buyOrderOne.price}))
                .then(() => checkGetOrderbookAsks([]))
                .then(() => checkGetOrderbookBids([{id: 3, owner: buyer, price: buyOrderThree.price, originalAmount: buyOrderThree.amount, amount: buyOrderThree.amount - sellOrder.amount}, {id: 1, owner: buyer, price: buyOrderOne.price, originalAmount: buyOrderOne.amount, amount: buyOrderOne.amount}, {id: 2, owner: buyer, price: buyOrderTwo.price, originalAmount: buyOrderThree.amount, amount: buyOrderTwo.amount}]))
        })

        it("sell order should match the best priced buy order after adding orders with the same price", () => {
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(90, 5);
            const buyOrderThree = buy(100, 5);
            const sellOrder = sell(80, 2);
            return placeOrder(buyOrderOne)
                .then(() => placeOrder(buyOrderTwo))
                .then(() => placeOrder(buyOrderThree))
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(4, undefined))
                .then(() => checkOrder(3, {amount: buyOrderThree.amount - sellOrder.amount, price: buyOrderThree.price}))
                .then(() => checkOrder(2, {amount: buyOrderTwo.amount, price: buyOrderTwo.price}))
                .then(() => checkOrder(1, {amount: buyOrderOne.amount, price: buyOrderOne.price}))
                .then(() => checkGetOrderbookAsks([]))
                .then(() => checkGetOrderbookBids([{id: 3, owner: buyer, price: buyOrderThree.price, originalAmount: buyOrderThree.amount, amount: buyOrderThree.amount - sellOrder.amount}, {id: 2, owner: buyer, price: buyOrderTwo.price, originalAmount: buyOrderThree.amount, amount: buyOrderTwo.amount}, {id: 1, owner: buyer, price: buyOrderOne.price, originalAmount: buyOrderOne.amount, amount: buyOrderOne.amount}]))
        })

        it("buy order should match the best priced sell order", () => {
            const sellOrderOne = sell(100, 5);
            const sellOrderTwo = sell(95, 5);
            const sellOrderThree = sell(90, 5);
            const buyOrder = buy(100, 2);
            return placeOrder(sellOrderOne)
                .then(() => placeOrder(sellOrderTwo))
                .then(() => placeOrder(sellOrderThree))
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(4, undefined))
                .then(() => checkOrder(3, {amount: sellOrderThree.amount - buyOrder.amount, price: sellOrderThree.price}))
                .then(() => checkOrder(2, {amount: sellOrderTwo.amount, price: sellOrderTwo.price}))
                .then(() => checkOrder(1, {amount: sellOrderOne.amount, price: sellOrderOne.price}))
                .then(() => checkGetOrderbookAsks([{id: 3, owner: seller, price: sellOrderThree.price, originalAmount: sellOrderThree.amount, amount: sellOrderThree.amount - buyOrder.amount}, {id:1, owner: seller, price: sellOrderOne.price, originalAmount: sellOrderOne.amount, amount: sellOrderOne.amount}, {id: 2, owner:seller, price: sellOrderTwo.price, originalAmount: sellOrderTwo.amount, amount: sellOrderTwo.amount}]))
                .then(() => checkGetOrderbookBids([]))
        })

        it("buy order should match the best priced sell order after adding orders with the same price", () => {
            const sellOrderOne = sell(100, 5);
            const sellOrderTwo = sell(100, 5);
            const sellOrderThree = sell(90, 5);
            const buyOrder = buy(100, 2);
            return placeOrder(sellOrderOne)
                .then(() => placeOrder(sellOrderTwo))
                .then(() => placeOrder(sellOrderThree))
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(4, undefined))
                .then(() => checkOrder(3, {amount: sellOrderThree.amount - buyOrder.amount, price: sellOrderThree.price}))
                .then(() => checkOrder(2, {amount: sellOrderTwo.amount, price: sellOrderTwo.price}))
                .then(() => checkOrder(1, {amount: sellOrderOne.amount, price: sellOrderOne.price}))
                .then(() => checkGetOrderbookAsks([{id: 3, owner: seller, price: sellOrderThree.price, originalAmount: sellOrderThree.amount, amount: sellOrderThree.amount - buyOrder.amount}, {id: 2, owner:seller, price: sellOrderTwo.price, originalAmount: sellOrderTwo.amount, amount: sellOrderTwo.amount}, {id:1, owner: seller, price: sellOrderOne.price, originalAmount: sellOrderOne.amount, amount: sellOrderOne.amount}]))
                .then(() => checkGetOrderbookBids([]))
        })

      it("should properly insert different bids with same prices", () => {
        let [buy10, buy11, buy12] = [buy(10, 1), buy(11, 1), buy(12, 1)]
        return placeOrder(buy10)
            .then(() => placeOrder(buy10))
            .then(() => placeOrder(buy11))
            .then(() => placeOrder(buy12))
            .then(() => placeOrder(buy12))
            .then(() => placeOrder(buy10))
            .then(() => placeOrder(buy12))
            .then(() => checkGetOrderbookBids([
              {id: 4, owner: buyer, price: buy12.price, originalAmount: buy12.amount, amount: buy12.amount},
              {id: 5, owner: buyer, price: buy12.price, originalAmount: buy12.amount, amount: buy12.amount},
              {id: 7, owner: buyer, price: buy12.price, originalAmount: buy12.amount, amount: buy12.amount},
              {id: 2, owner: buyer, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount},
              {id: 3, owner: buyer, price: buy11.price, originalAmount: buy11.amount, amount: buy11.amount},
              {id: 6, owner: buyer, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount},
              {id: 1, owner: buyer, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount}
            ]))
      })

      it("should properly insert different asks with same prices", () => {
        let [ask15, ask14, ask13, ask12] = [sell(15, 1), sell(14, 1), sell(13, 1), sell(12, 1)]
        return placeOrder(ask15)
            .then(() => placeOrder(ask15))
            .then(() => placeOrder(ask14))
            .then(() => placeOrder(ask14))
            .then(() => placeOrder(ask13))
            .then(() => placeOrder(ask13))
            .then(() => placeOrder(ask12))
            .then(() => placeOrder(ask12))
            .then(() => placeOrder(ask15))
            .then(() => placeOrder(ask13))
            .then(() => checkGetOrderbookAsks([
              {id: 7, owner: seller, price: ask12.price, originalAmount: ask12.amount, amount: ask12.amount},
              {id: 8, owner: seller, price: ask12.price, originalAmount: ask12.amount, amount: ask12.amount},
              {id: 5, owner: seller, price: ask13.price, originalAmount: ask13.amount, amount: ask13.amount},
              {id: 3, owner: seller, price: ask14.price, originalAmount: ask14.amount, amount: ask14.amount},
              {id: 10, owner: seller, price: ask13.price, originalAmount: ask13.amount, amount: ask13.amount},
              {id: 1, owner: seller, price: ask15.price, originalAmount: ask15.amount, amount: ask15.amount},
              {id: 6, owner: seller, price: ask13.price, originalAmount: ask13.amount, amount: ask13.amount},
              {id: 2, owner: seller, price: ask15.price, originalAmount: ask15.amount, amount: ask15.amount},
              {id: 9, owner: seller, price: ask15.price, originalAmount: ask15.amount, amount: ask15.amount},
              {id: 4, owner: seller, price: ask14.price, originalAmount: ask14.amount, amount: ask14.amount}
            ]))
      })
    });

    describe("Admin", () => {
        describe("Pause", () => {
            it("should not allow non-owner to pause exchange", async () => {
                await exchange.pause({ from: notExchangeOwner }).should.be.rejectedWith(EVMRevert)
            })

            it("should not be able to create buy orders when paused", async () => {
                const buyOrder = buy(105, 10)

                await exchange.pause({ from: exchangeOwner }).should.be.fulfilled

                await placeOrder(buyOrder).should.be.rejectedWith(EVMRevert)
            })

            it("should not be able to create sell orders when paused", async function () {
                const sellOrder = sell(105, 10)

                await exchange.pause({ from: exchangeOwner }).should.be.fulfilled

                await placeOrder(sellOrder).should.be.rejectedWith(EVMRevert)
            })
        })

        describe("Cancel Order", () => {
            it("should allow owner to cancel any order", async () => {
                const buyOrder = buy(100, 5)
                await placeOrder(buyOrder).should.be.fulfilled

                await cancelOrder(1, exchangeOwner).should.be.fulfilled
            })
        })

        describe("Set Limits", () => {
            it("should only allow owner to set min price size", async () => {
                const currentMin = await exchange.MIN_PRICE_SIZE()
                const newMin = currentMin.times(2)

                await exchange.setMinPriceSize(newMin, { from: notExchangeOwner }).should.be.rejectedWith(EVMRevert)
                await exchange.setMinPriceSize(newMin, { from: exchangeOwner }).should.be.fulfilled

                const actualMin = await exchange.MIN_PRICE_SIZE()
                assert(actualMin.toString(), newMin.toString())
            })

            it("should only allow owner to set max order size", async () => {
                const currentMax = await exchange.MAX_TOTAL_SIZE()
                const newMax = currentMax.times(2)

                await exchange.setMaxTotalSize(newMax, { from: notExchangeOwner }).should.be.rejectedWith(EVMRevert)
                await exchange.setMaxTotalSize(newMax, { from: exchangeOwner }).should.be.fulfilled

                const actualMax = await exchange.MAX_TOTAL_SIZE()
                assert(actualMax.toString(), newMax.toString())
            })

            it("should only allow owner to set min order size", async () => {
                const currentMin = await exchange.MIN_AMOUNT_SIZE()
                const newMin = currentMin.times(2)

                await exchange.setMinAmountSize(newMin, { from: notExchangeOwner }).should.be.rejectedWith(EVMRevert)
                await exchange.setMinAmountSize(newMin, { from: exchangeOwner }).should.be.fulfilled

                const actualMin = await exchange.MIN_AMOUNT_SIZE()
                assert(actualMin.toString(), newMin.toString())
            })

            it("should only allow owner to set max get trades size", async () => {
                const currentMax = await exchange.MAX_GET_RETURN_SIZE()
                const newMax = currentMax.times(2)

                await exchange.setMaxGetTradesSize(newMax, { from: notExchangeOwner }).should.be.rejectedWith(EVMRevert)
                await exchange.setMaxGetTradesSize(newMax, { from: exchangeOwner }).should.be.fulfilled

                const actualMax = await exchange.MIN_AMOUNT_SIZE()
                assert(actualMax.toString(), newMax.toString())
            })
        })
    })

    describe("Upgrade", () => {
        it("existing orders should remain after upgrade ", async () => {
            // GIVEN
            const sellOrder = sell(105, 10)
            await placeOrder(sellOrder)

            // THEN
            const newExchange = await Exchange.new({ gas: 15000000 })
            await exchangeProxy.upgradeTo(newExchange.address, { from: proxyOwner })

            // EXPECT
            const actualOrder = await exchange.getOrder(1)
            assert(actualOrder[0], sellOrder.price)
        })
    })

    describe('Fallback trap', async() => {
        const price = 5;
        let order;

        beforeEach(() => {
            order = {
                baseToken: etherAddress,
                tradeToken: tradeToken.address,
                amount: toWei(0.0001),
                price: toWei(price),
                from: buyer,
                sell: false
            }
        })

        it('should be able to interact with the exchange via an intermediate contract', async () => {
            const exchangeEtherBalanceBefore = await web3.eth.getBalance(exchange.address)

            const newOrderEventWatcher = exchange.NewOrder();
            const cancelOrderEventWatcher = exchange.NewCancelOrder();
            await fallbackTrap.buy(order.baseToken, order.tradeToken, fallbackTrap.address, order.amount, order.price, { from: order.from, value: order.amount * price, gasPrice: 0 })
            const id = newOrderEventWatcher.get()[0].args.id;
            await fallbackTrap.cancelOrder(id, { from: buyer, gasPrice:0, value: 0 });
            checkCancelOrderEvent(cancelOrderEventWatcher, {id, baseToken: order.baseToken, tradeToken: order.tradeToken, owner: fallbackTrap.address, sell: order.sell, price: order.price, amount: order.amount})

            assert.equal(order.amount * price, (await web3.eth.getBalance(fallbackTrap.address)).toString())
            assert.equal(exchangeEtherBalanceBefore.toString(), (await web3.eth.getBalance(exchange.address)).toString())
        })

        it('should not be vulnerable to the fallback trap', async () => {
            const exchangeEtherBalanceBefore = await web3.eth.getBalance(exchange.address)

            await fallbackTrap.arm();

            const newOrderEventWatcher = exchange.NewOrder();
            const cancelOrderEventWatcher = exchange.NewCancelOrder();
            await fallbackTrap.buy(order.baseToken, order.tradeToken, fallbackTrap.address, order.amount, order.price, { from: order.from, value: order.amount * price, gasPrice: 0 })
            const id = newOrderEventWatcher.get()[0].args.id;
            await fallbackTrap.cancelOrder(id, { from: buyer, gasPrice:0, value: 0 });
            checkCancelOrderEvent(cancelOrderEventWatcher, {id, baseToken: order.baseToken, tradeToken: order.tradeToken, owner: fallbackTrap.address, sell: order.sell, price: order.price, amount: order.amount})

            assert.equal(order.amount * price, (await web3.eth.getBalance(fallbackTrap.address)).toString())
            assert.equal(exchangeEtherBalanceBefore.toString(), (await web3.eth.getBalance(exchange.address)).toString())
        })
    });

    describe("Get Orderbook", () => {
        it("should return 0 asks when empty", () => {
            return checkGetAsks([])
        })

        it("should return 0 bids when empty", () => {
            return checkGetBids([])
        })

        it("should get all ask orders", () => {
            let [sell10, sell11, sell12] = [sell(10, 1), sell(11, 1), sell(12, 1)]
            return placeOrder(sell10)
                .then(() => placeOrder(sell11))
                .then(() => placeOrder(sell12))
                .then(() => checkGetAsks([
                  {id: 1, owner: seller, price: sell10.price, originalAmount: sell10.amount, amount: sell10.amount},
                  {id: 2, owner: seller, price: sell11.price, originalAmount: sell11.amount, amount: sell11.amount},
                  {id: 3, owner: seller, price: sell12.price, originalAmount: sell12.amount, amount: sell12.amount},
                ]))
        })

        it("should get all bid orders", () => {
            let [buy10, buy11, buy12] = [buy(10, 1), buy(11, 1), buy(12, 1)]
            return placeOrder(buy10)
                .then(() => placeOrder(buy11))
                .then(() => placeOrder(buy12))
                .then(() => checkGetBids([
                  {id: 3, owner: buyer, price: buy12.price, originalAmount: buy12.amount, amount: buy12.amount},
                  {id: 1, owner: buyer, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount},
                  {id: 2, owner: buyer, price: buy11.price, originalAmount: buy11.amount, amount: buy11.amount},
                ]))
        })

        it("should get original ask amount after matching", () => {
            let sellOrder = sell(10, 3)
            let buyOrder = buy(10, 1)
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkGetAsks([
                  {id: 1, owner: seller, price: sellOrder.price, originalAmount: sellOrder.amount, amount: sellOrder.amount.minus(buyOrder.amount)}
                ]))
        })

        it("should get original bid amount after matching", () => {
            let buyOrder = buy(10, 3)
            let sellOrder = sell(10, 1)
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkGetBids([
                  {id: 1, owner: buyer, price: buyOrder.price, originalAmount: buyOrder.amount, amount: buyOrder.amount.minus(sellOrder.amount)}
                ]))
        })
    })

    describe("User Open Orders and History", () => {
        it("should return user buy orders", () => {
          let buyOrder = buy(10, 1)
          return placeOrder(buyOrder)
              .then(() => placeOrder(buyOrder))
              .then(() => placeOrder(buyOrder))
              .then(() => checkUserOrders([
                {id: 1, price: buyOrder.price, originalAmount: buyOrder.amount, amount: buyOrder.amount, isSell: false, timeCancelled: 0},
                {id: 2, price: buyOrder.price, originalAmount: buyOrder.amount, amount: buyOrder.amount, isSell: false, timeCancelled: 0},
                {id: 3, price: buyOrder.price, originalAmount: buyOrder.amount, amount: buyOrder.amount, isSell: false, timeCancelled: 0}
              ], buyer))
        })

        it("should return user sell orders", () => {
          let sellOrder = sell(10, 1)
          return placeOrder(sellOrder)
              .then(() => placeOrder(sellOrder))
              .then(() => placeOrder(sellOrder))
              .then(() => checkUserOrders([
                {id: 1, price: sellOrder.price, originalAmount: sellOrder.amount, amount: sellOrder.amount, isSell: true, timeCancelled: 0},
                {id: 2, price: sellOrder.price, originalAmount: sellOrder.amount, amount: sellOrder.amount, isSell: true, timeCancelled: 0},
                {id: 3, price: sellOrder.price, originalAmount: sellOrder.amount, amount: sellOrder.amount, isSell: true, timeCancelled: 0}
              ], seller))
        })

        it("should update maker buy orders amounts on matchSell, and add to history and remove from open orders on fill", () => {
          let buy1 = buy(10, 1)
          let buy2 = buy(10, 2)
          let sell2 = sell(10, 2)
          return placeOrder(buy1)
              .then(() => placeOrder(buy2))
              .then(() => placeOrder(sell2))
              .then(() => checkUserOrderHistory([
                {id: 1, price: buy1.price, originalAmount: buy1.amount, amount: 0, isSell: false, timeCancelled: 0}
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrderHistory([
                {id: 3, price: sell2.price, originalAmount: sell2.amount, amount: 0, isSell: true, timeCancelled: 0}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrders([
                {id: 2, price: buy2.price, originalAmount: buy2.amount, amount: buy2.amount.div(2), isSell: false, timeCancelled: 0}
              ], buyer))
              .then(() => checkUserOrders([], seller))
        })

        it("should update taker sell orders amounts on matchSell, and add to history and remove from open orders on fill", () => {
          let buy2 = buy(10, 2)
          let sell1 = sell(10, 1)
          let sell2 = sell(10, 2)
          return placeOrder(buy2)
              .then(() => placeOrder(sell1))
              .then(() => placeOrder(sell2))
              .then(() => checkUserOrderHistory([
                {id: 2, price: sell1.price, originalAmount: sell1.amount, amount: 0, isSell: true, timeCancelled: 0}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrderHistory([
                {id: 1, price: buy2.price, originalAmount: buy2.amount, amount: 0, isSell: false, timeCancelled: 0}
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrders([
                {id: 3, price: sell2.price, originalAmount: sell2.amount, amount: sell2.amount.div(2), isSell: true, timeCancelled: 0}
              ], seller))
              .then(() => checkUserOrders([], buyer))
        })

        it("should update maker sell orders amounts on matchBuy, and add to history and remove from open orders on fill", () => {
          let sell1 = sell(10, 1)
          let sell2 = sell(10, 2)
          let buy2 = buy(10, 2)
          return placeOrder(sell1)
              .then(() => placeOrder(sell2))
              .then(() => placeOrder(buy2))
              .then(() => checkUserOrderHistory([
                {id: 1, price: sell1.price, originalAmount: sell1.amount, amount: 0, isSell: true, timeCancelled: 0}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrderHistory([
                {id: 3, price: buy2.price, originalAmount: buy2.amount, amount: 0, isSell: false, timeCancelled: 0}
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrders([
                {id: 2, price: sell2.price, originalAmount: sell2.amount, amount: sell2.amount.div(2), isSell: true, timeCancelled: 0}
              ], seller))
              .then(() => checkUserOrders([], buyer))
        })

        it("should update taker buy orders amounts on matchBuy, and add to history and remove from open orders on fill", () => {
          let sell2 = sell(10, 2)
          let buy1 = buy(10, 1)
          let buy2 = buy(10, 2)
          return placeOrder(sell2)
              .then(() => placeOrder(buy1))
              .then(() => placeOrder(buy2))
              .then(() => checkUserOrderHistory([
                {id: 2, price: buy1.price, originalAmount: buy1.amount, amount: 0, isSell: false, timeCancelled: 0}
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrderHistory([
                {id: 1, price: sell2.price, originalAmount: sell2.amount, amount: 0, isSell: true, timeCancelled: 0}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrders([
                {id: 3, price: buy2.price, originalAmount: buy2.amount, amount: buy2.amount.div(2), isSell: false, timeCancelled: 0}
              ], buyer))
              .then(() => checkUserOrders([], seller))
        })

        it("should add to history and remove from open orders on cancel", () => {
          let sellOrder = sell(10, 1)
          let buyOrder = buy(9, 1)
          let sellOrderCancelledTime = 0;
          let buyOrderCancelledTime = 0;
          return placeOrder(sellOrder)
              .then(() => placeOrder(buyOrder))
              .then(() => cancelOrder(1, seller))
              .then(async() => {
                sellOrderCancelledTime = await time.latest()
              })
              .then(() => cancelOrder(2, buyer))
              .then(async() => {
                buyOrderCancelledTime = await time.latest()
              })
              .then(() => checkUserOrderHistory([
                {id: 1, price: sellOrder.price, originalAmount: sellOrder.amount, amount: sellOrder.amount, isSell: true, timeCancelled: sellOrderCancelledTime}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrderHistory([
                {id: 2, price: buyOrder.price, originalAmount: buyOrder.amount, amount: buyOrder.amount, isSell: false, timeCancelled: buyOrderCancelledTime},
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
              .then(() => checkUserOrders([], buyer))
              .then(() => checkUserOrders([], seller))
        })

        it("should not exceed MAX_GET_RETURN_SIZE when getting order history", () => {
          let buy10 = buy(10, 1)
          let sell10 = sell(10, 1)
          const exceededLimit = 5
          return placeOrder(buy10)
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => checkUserOrderHistory([
                {id: 5, price: buy10.price, originalAmount: buy10.amount, amount: 0, isSell: false, timeCancelled: 0},
                {id: 4, price: buy10.price, originalAmount: buy10.amount, amount: 0, isSell: false, timeCancelled: 0},
                {id: 3, price: buy10.price, originalAmount: buy10.amount, amount: 0, isSell: false, timeCancelled: 0}
              ], buyer, DEFAULT_GET_TIME_RANGE, exceededLimit))
              .then(() => checkUserOrderHistory([
                {id: 10, price: sell10.price, originalAmount: sell10.amount, amount: 0, isSell: true, timeCancelled: 0},
                {id: 9, price: sell10.price, originalAmount: sell10.amount, amount: 0, isSell: true, timeCancelled: 0},
                {id: 8, price: sell10.price, originalAmount: sell10.amount, amount: 0, isSell: true, timeCancelled: 0}
              ], seller, DEFAULT_GET_TIME_RANGE, exceededLimit))
              .then(() => checkUserOrders([], seller))
              .then(() => checkUserOrders([], buyer))
        })

        it("should not exceed MAX_GET_RETURN_SIZE when getting open orders", () => {
          let buy10 = buy(10, 1)
          const exceededLimit = 5
          return placeOrder(buy10)
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => checkUserOrders([
                {id: 1, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount, isSell: false},
                {id: 2, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount, isSell: false},
                {id: 3, price: buy10.price, originalAmount: buy10.amount, amount: buy10.amount, isSell: false}
              ], buyer))
        })
    })

    describe("User Trade History", () => {
        it("should return consolidated buy trades", () => {
          let buy10 = buy(10, 3)
          let sell9 = sell(9, 1)
          let sell10 = sell(10, 1)
          return placeOrder(sell9)
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(buy10))
              .then(() => checkUserTradeHistory([
                {id: 4, price: sell10.price, amount: sell10.amount.mul(2), isSell: false},
                {id: 4, price: sell9.price, amount: sell9.amount, isSell: false}
              ], buyer, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
        })

        it("should return consolidated sell trades", () => {
          let sell10 = sell(10, 3)
          let buy11 = buy(11, 1)
          let buy10 = buy(10, 1)
          return placeOrder(buy11)
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(sell10))
              .then(() => checkUserTradeHistory([
                {id: 4, price: buy10.price, amount: buy10.amount.mul(2), isSell: true},
                {id: 4, price: buy11.price, amount: buy11.amount, isSell: true}
              ], seller, DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
        })

        it("should not exceed MAX_GET_RETURN_SIZE", async() => {
          let sell10 = sell(10, 1)
          let buy10 = buy(10, 1)
          const exceededLimit = 5
          return placeOrder(sell10)
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => checkUserTradeHistory([
                {id: 10, price: sell10.price, amount: sell10.amount, isSell: false},
                {id: 9, price: sell10.price, amount: sell10.amount, isSell: false},
                {id: 8, price: sell10.price, amount: sell10.amount, isSell: false}
              ], buyer, DEFAULT_GET_TIME_RANGE, exceededLimit))
        })
    })

    describe("Trade History", () => {
        it("should return consolidated buy trades", () => {
          let buy10 = buy(10, 3)
          let sell9 = sell(9, 1)
          let sell10 = sell(10, 1)
          return placeOrder(sell9)
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(buy10))
              .then(() => checkTradeHistory([
                {id: 4, price: sell10.price, amount: sell10.amount.mul(2), isSell: false},
                {id: 4, price: sell9.price, amount: sell9.amount, isSell: false}
              ], DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
        })

        it("should return consolidated sell trades", () => {
          let sell10 = sell(10, 3)
          let buy11 = buy(11, 1)
          let buy10 = buy(10, 1)
          return placeOrder(buy11)
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(sell10))
              .then(() => checkTradeHistory([
                {id: 4, price: buy10.price, amount: buy10.amount.mul(2), isSell: true},
                {id: 4, price: buy11.price, amount: buy11.amount, isSell: true}
              ], DEFAULT_GET_TIME_RANGE, MAX_GET_RETURN_SIZE))
        })

        it("should not exceed MAX_GET_RETURN_SIZE", async() => {
          let sell10 = sell(10, 1)
          let buy10 = buy(10, 1)
          const exceededLimit = 5
          return placeOrder(sell10)
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(sell10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => placeOrder(buy10))
              .then(() => checkTradeHistory([
                {id: 10, price: sell10.price, amount: sell10.amount, isSell: false},
                {id: 9, price: sell10.price, amount: sell10.amount, isSell: false},
                {id: 8, price: sell10.price, amount: sell10.amount, isSell: false}
              ], DEFAULT_GET_TIME_RANGE, exceededLimit))
        })
    })

    async function deployExchange() {
        baseToken = await Token.new()
        tradeToken = await Token.new()
        let exchangeInstance = await Exchange.new({ gas: 15000000 })
        exchangeProxy = await ExchangeProxy.new(exchangeInstance.address, { from: proxyOwner })
        exchange = await Exchange.at(exchangeProxy.address)
        await exchange.initialize({ from: exchangeOwner })

        // Set Limits
        await exchange.setMaxGetTradesSize(MAX_GET_RETURN_SIZE, { from: exchangeOwner }).should.be.fulfilled
    }

    async function deployFallbackTrap() {
        fallbackTrap = await FallbackTrap.new();
        await fallbackTrap.init(exchangeProxy.address, {})
    }

    async function initBalances() {
        await baseToken.setBalance(tokenDepositAmount, {from: buyer})
        await tradeToken.setBalance(tokenDepositAmount, {from: seller})
    }

    function checkBalance(token, trader, expectedBalance) {
        return exchange.reserved(token, trader)
            .then(reservedBalance => {
                assert.equal(reservedBalance.toExponential(10), expectedBalance.reserved.toExponential(10), "reserved balance");
            })
            .then(() => {
                return Token.at(token)
            })
            .then((tokenInstance) => {
                return tokenInstance.balanceOf(trader)
            })
            .then((availableBalance) => {
                assert.equal(availableBalance.toExponential(10), expectedBalance.available.toExponential(10), "available balance");
            });
    }

    function sell(price, amount) {
        return {sell: true, price: toWei(price), amount: toWei(amount), from: seller, total: toWei(price * amount)};
    }

    function buy(price, amount) {
        return {sell: false, price: toWei(price), amount: toWei(amount), from: buyer, total: toWei(price * amount)};
    }

    function checkOrder(id, orderState) {
        if (orderState == undefined) {
            orderState = {price: 0, sell: false, amount: 0}
        }

        return exchange.getOrder(id)
            .then(order => {
                if (orderState.price != undefined)
                    assert.equal(order[3].toFixed(), orderState.price, "price")
                if (orderState.sell != undefined)
                    assert.equal(order[6], orderState.sell, "order type")
                if (orderState.amount != undefined)
                    assert.equal(order[5].toFixed(), orderState.amount, "amount")
            });
    }

    function checkOrderbook(orderbookState) {
        return exchange.getOrderBookInfo(baseToken.address, tradeToken.address)
            .then(orderbook => {
                assert.equal(orderbook[0].toFixed(), orderbookState.bestAsk, "best ask")
                assert.equal(orderbook[1].toFixed(), orderbookState.bestBid, "best bid")
            });
    }

    function checkGetOrderbookAsks(expectedAsks) {
        return exchange.getAsks(baseToken.address, tradeToken.address)
            .then(result => {
                const asks = parseGetResult(result);
                for (let i = 0; i < expectedAsks.length; i++) {
                    assert.equal(asks.id[i], expectedAsks[i].id);
                    assert.equal(asks.owner[i], expectedAsks[i].owner);
                    assert.equal(asks.price[i], expectedAsks[i].price);
                    assert.equal(asks.originalAmount[i], expectedAsks[i].originalAmount);
                    assert.equal(asks.amount[i], expectedAsks[i].amount);
                }
            });
    }

    function checkGetOrderbookBids(expectedBids) {
        return exchange.getBids(baseToken.address, tradeToken.address)
            .then(result => {
                const bids = parseGetResult(result);
                for (let i = 0; i < expectedBids.length; i++) {
                    assert.equal(bids.id[i], expectedBids[i].id);
                    assert.equal(bids.owner[i], expectedBids[i].owner);
                    assert.equal(bids.price[i], expectedBids[i].price);
                    assert.equal(bids.originalAmount[i], expectedBids[i].originalAmount);
                    assert.equal(bids.amount[i], expectedBids[i].amount);
                }
            });
    }

    function checkGetBids(expectedBids) {
        return exchange.getBids(baseToken.address, tradeToken.address)
            .then(result => {
                const bids = parseGetResult(result)
                for (let i = 0; i < expectedBids.length; i++) {
                    assert.equal(bids.id[i], expectedBids[i].id)
                    assert.equal(bids.owner[i], expectedBids[i].owner)
                    assert.equal(bids.price[i], expectedBids[i].price)
                    assert.equal(bids.originalAmount[i], expectedBids[i].originalAmount.toFixed())
                    assert.equal(bids.amount[i], expectedBids[i].amount)
                }
            })
    }

    function checkGetAsks(expectedAsks) {
        return exchange.getAsks(baseToken.address, tradeToken.address)
            .then(result => {
                const asks = parseGetResult(result)
                for (let i = 0; i < expectedAsks.length; i++) {
                    assert.equal(asks.id[i], expectedAsks[i].id)
                    assert.equal(asks.owner[i], expectedAsks[i].owner)
                    assert.equal(asks.price[i], expectedAsks[i].price)
                    assert.equal(asks.originalAmount[i], expectedAsks[i].originalAmount)
                    assert.equal(asks.amount[i], expectedAsks[i].amount)
                }
            })
    }

    function checkTradeHistory(expectedTrades, timeRange, limit) {
        return exchange.getTradeHistory(limit, timeRange, tradeToken.address, baseToken.address)
            .then(result => {
                const trades = parseTradeResult(result)
                assert.equal(trades.id.length, expectedTrades.length)
                for (let i = 0; i < expectedTrades.length; i++) {
                    assert.equal(trades.id[i], expectedTrades[i].id)
                    assert.equal(trades.price[i], expectedTrades[i].price)
                    assert.equal(trades.amount[i], expectedTrades[i].amount)
                    assert.equal(trades.isSell[i], expectedTrades[i].isSell)
                }
            })
    }

    function checkUserTradeHistory(expectedTrades, user, timeRange, limit) {
        return exchange.getUserTradeHistory(limit, timeRange, user, tradeToken.address, baseToken.address)
            .then(result => {
                const trades = parseTradeResult(result)
                assert.equal(trades.id.length, expectedTrades.length)
                for (let i = 0; i < expectedTrades.length; i++) {
                    assert.equal(trades.id[i], expectedTrades[i].id)
                    assert.equal(trades.price[i], expectedTrades[i].price)
                    assert.equal(trades.amount[i], expectedTrades[i].amount)
                    assert.equal(trades.isSell[i], expectedTrades[i].isSell)
                }
            })
    }

    function checkUserOrders(expectedOrders, user) {
        return exchange.getUserOrders(user, tradeToken.address, baseToken.address)
            .then(result => {
                const orders = parseOpenOrderResult(result)
                assert.equal(orders.id.length, expectedOrders.length)
                for (let i = 0; i < expectedOrders.length; i++) {
                    assert.equal(orders.id[i], expectedOrders[i].id)
                    assert.equal(orders.price[i], expectedOrders[i].price)
                    assert.equal(orders.originalAmount[i], expectedOrders[i].originalAmount.toString())
                    assert.equal(orders.amount[i], expectedOrders[i].amount.toString())
                    assert.equal(orders.isSell[i], expectedOrders[i].isSell)
                }
            })
    }

    function checkUserOrderHistory(expectedOrders, user, timeRange, limit) {
        return exchange.getUserOrderHistory(limit, timeRange, user, tradeToken.address, baseToken.address)
            .then(result => {
                const orders = parseOrderHistoryResult(result)
                assert.equal(orders.id.length, expectedOrders.length)
                for (let i = 0; i < expectedOrders.length; i++) {
                    assert.equal(orders.id[i], expectedOrders[i].id)
                    assert.equal(orders.price[i], expectedOrders[i].price)
                    assert.equal(orders.originalAmount[i], expectedOrders[i].originalAmount.toString())
                    assert.equal(orders.amount[i], expectedOrders[i].amount.toString())
                    assert.equal(orders.isSell[i], expectedOrders[i].isSell)
                    assert.equal(orders.timeCancelled[i], expectedOrders[i].timeCancelled)
                }
            })
    }

    function checkTradeEvents(watcher, eventsState) {
        let events = watcher.get();
        assert.equal(events.length, eventsState.length);

        for (let i = 0; i < events.length; i++) {
            let event = events[i].args;
            let state = eventsState[i];
            assert.equal(event.tokenPairHash, getTokenPairHash());
            assert.equal(event.bidId, state.bidId);
            assert.equal(event.askId, state.askId);
            assert.equal(event.bidOwner, state.bidOwner);
            assert.equal(event.askOwner, state.askOwner);
            assert.equal(event.isSell, state.isSell);
            assert.equal(event.amount.toString(), state.amount.toString());
            assert.equal(event.price.toString(), state.price.toString());
        }
    }

    function checkNewOrderEvent(watcher, expectedState) {
        let events = watcher.get();
        assert.equal(events.length, 1);

        let event = events[0].args;
        assert.equal(event.baseToken, baseToken.address);
        assert.equal(event.tradeToken, tradeToken.address);
        assert.equal(event.owner, expectedState.from);
        assert.equal(event.id, expectedState.id);
        assert.equal(event.isSell, expectedState.sell);
        assert.equal(event.price.toString(), expectedState.price.toString());
        assert.equal(event.amount.toString(), expectedState.amount.toString());
    }

    function checkCancelOrderEvent(watcher, expectedState) {
        let events = watcher.get();
        assert.equal(events.length, 1);

        let event = events[0].args;
        assert.equal(event.baseToken, expectedState.baseToken);
        assert.equal(event.tradeToken, expectedState.tradeToken);
        assert.equal(event.owner, expectedState.owner);
        assert.equal(event.id.toString(), expectedState.id.toString());
        assert.equal(event.isSell, expectedState.sell);
        assert.equal(event.price.toString(), expectedState.price.toString());
        assert.equal(event.amount.toString(), expectedState.amount.toString());
    }

    async function placeOrder(order) {
        let placeOrderTestPromise;
        if (order.sell === true) {
            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            placeOrderTestPromise = exchange.sell(baseToken.address, tradeToken.address, order.from, order.amount, order.price, { from: order.from })
        } else {
            await baseToken.approve(exchange.address, order.total, { from: order.from })
            placeOrderTestPromise = exchange.buy(baseToken.address, tradeToken.address, order.from, order.amount, order.price, { from: order.from })
        }
        return placeOrderTestPromise.then(() => orderId++);
    }

    function cancelOrder(id, from) {
        return exchange.cancelOrder(id, {from: from});
    }

    function testOrder(order, orderbookState) {
        return placeOrder(order)
            .then(id => {
                let orderState = {
                    price: order.price,
                    sell: order.sell,
                    amount: order.amount
                };
                return checkOrder(id, orderState);
            }).then(() => {
                return checkOrderbook(orderbookState);
            });
    }

    function parseGetResult(result) {
        return {
            id: result[0].map(t => t.toNumber()),
            owner: result[1].map(t => t.toString()),
            price: result[2].map(t => t.toNumber()),
            originalAmount: result[3].map(t => t.toNumber()),
            amount: result[4].map(t => t.toNumber())
        }
    }

    function parseTradeResult(result) {
        return {
            id: result[0].map(t => t.toNumber()),
            price: result[1].map(t => t.toNumber()),
            amount: result[2].map(t => t.toNumber()),
            isSell: result[3]
        }
    }

    function parseOrderHistoryResult(result) {
        return {
            id: result[0].map(t => t.toNumber()),
            price: result[1].map(t => t.toNumber()),
            originalAmount: result[2].map(t => t.toNumber()),
            amount: result[3].map(t => t.toNumber()),
            isSell: result[4],
            timeCancelled: result[5].map(t => t.toNumber())
        }
    }

    function parseOpenOrderResult(result) {
        return {
            id: result[0].map(t => t.toNumber()),
            price: result[1].map(t => t.toNumber()),
            originalAmount: result[2].map(t => t.toNumber()),
            amount: result[3].map(t => t.toNumber()),
            isSell: result[4]
        }
    }

    function getTokenPairHash() {
        const baseTokenStr = (baseToken.address).replace(/^0x/, '')
        const tradeTokenStr = (tradeToken.address).replace(/^0x/, '')
        const tokenPair = `0x${baseTokenStr}${tradeTokenStr}`
        const hash = web3.sha3(tokenPair, {encoding: 'hex'})
        return hash
    }
})
