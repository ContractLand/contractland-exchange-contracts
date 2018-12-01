import { expect } from 'chai'
import EVMRevert from './helpers/EVMRevert'
import toWei from './helpers/toWei'
import fromWei from './helpers/fromWei'

require('chai')
  .use(require('chai-as-promised'))
  .should()

const Exchange = artifacts.require("./NewExchange.sol");
const ExchangeProxy = artifacts.require('AdminUpgradeabilityProxy')
const Token = artifacts.require("./TestToken.sol");
const FallbackTrap = artifacts.require("./FallbackTrap.sol");

describe("Exchange", () => {
    const [deployer, buyer, seller, proxyOwner, exchangeOwner, notExchangeOwner] = web3.eth.accounts;
    let exchange, exchangeProxy, baseToken, tradeToken, orderId, fallbackTrap;
    const etherAddress = '0x0000000000000000000000000000000000000000'
    const invalidToken = '0x1111111111111111111111111111111111111111'
    const MAX_ORDER_SIZE = toWei(1000000000)
    const MIN_ORDER_SIZE = toWei(0.00001)
    const tokenDepositAmount = MAX_ORDER_SIZE.times(2);

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

        it("should not be able to create sell order with tradeToken amount greater than MAX_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MAX_ORDER_SIZE.plus(1),
              'price': 1,
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with baseToken amount greater than MAX_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': toWei(1),
              'price': MAX_ORDER_SIZE.plus(1),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with tradeToken amount greater than MAX_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MAX_ORDER_SIZE.plus(1),
              'price': 1,
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with baseToken amount greater than MAX_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': toWei(1),
              'price': MAX_ORDER_SIZE.plus(1),
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with tradeToken amount less than MIN_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MIN_ORDER_SIZE.minus(1),
              'price': toWei(1),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create sell order with baseToken amount less than MIN_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': toWei(1),
              'price': MIN_ORDER_SIZE.minus(1),
              'from': seller
            }

            await tradeToken.approve(exchange.address, order.amount, { from: order.from })
            await exchange.sell(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with tradeToken amount less than MIN_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': MIN_ORDER_SIZE.minus(1),
              'price': toWei(1),
              'from': buyer
            }

            await baseToken.approve(exchange.address, order.amount * order.price, { from: order.from })
            await exchange.buy(order.baseToken, order.tradeToken, order.from, order.amount, order.price, {from: order.from}).should.be.rejectedWith(EVMRevert)
        })

        it("should not be able to create buy order with baseToken amount less than MIN_ORDER_SIZE", async () => {
            const order = {
              'baseToken': baseToken.address,
              'tradeToken': tradeToken.address,
              'amount': toWei(1),
              'price': MIN_ORDER_SIZE.minus(1),
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

        it.only("should insert a new buy order as first", () => {
            const order = buy(100, 5);
            const orderState = {prev: 0, next: 0};
            const orderbookState = {firstOrder: 1, bestBid: 1, bestAsk: 0, lastOrder: 1};
            // const newBestBidWatcher = exchange.NewBestBid();
            // const newBidWatcher = exchange.NewBid();
            const newOrderWatcher = exchange.NewOrder();
            return testOrder(order, orderState, orderbookState)
                .then(() => {
                    let eventState = order;
                    eventState.id = 1;
                    checkNewOrderEvent(newOrderWatcher, eventState);
                })
                // .then(() => checkNewAskOrBidEvent(newBestBidWatcher, {price: order.price}))
                // .then(() => checkNewAskOrBidEvent(newBidWatcher, {price: order.price}))
                .then(() => checkBalance(baseToken.address, order.from, {available: tokenDepositAmount - order.total, reserved: order.total}));
        });

        it("should insert a new sell order as first", () => {
            const order = sell(100, 5);
            const orderState = {prev: 0, next: 0};
            const orderbookState = {firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 1};
            // const newBestAskWatcher = exchange.NewBestAsk();
            // const newAskWatcher = exchange.NewAsk();
            const newOrderWatcher = exchange.NewOrder();
            return testOrder(order, orderState, orderbookState)
                .then(() => {
                    let eventState = order;
                    eventState.id = 1;
                    checkNewOrderEvent(newOrderWatcher, eventState);
                })
                // .then(() => checkNewAskOrBidEvent(newBestAskWatcher, {price: order.price}))
                // .then(() => checkNewAskOrBidEvent(newAskWatcher, {price: order.price}))
                .then(() => checkBalance(tradeToken.address, order.from, {available: tokenDepositAmount - order.amount, reserved: order.amount}));
        });

        it("should cancel the last single buy order", () => {
            const order = buy(100, 5);
            let orderId;
            // const newBestBidWatcher = exchange.NewBestBid();
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(order)
                .then(id => orderId = id)
                .then(() => cancelOrder(orderId, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: orderId}))
                .then(() => checkOrder(orderId, undefined))
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}))
                // .then(() => checkNewAskOrBidEvent(newBestBidWatcher, {price: 0}))
                .then(() => checkBalance(baseToken.address, order.from, {available: tokenDepositAmount, reserved: 0}));
        });

        it("should cancel the last single sell order", () => {
            const order = sell(100, 5);
            let orderId;
            // const newBestAskWatcher = exchange.NewBestAsk();
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(order)
                .then(id => orderId = id)
                .then(() => cancelOrder(orderId, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: orderId}))
                .then(() => checkOrder(orderId, undefined))
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}))
                // .then(() => checkNewAskOrBidEvent(newBestAskWatcher, {price: 0}))
                .then(() => checkBalance(tradeToken.address, order.from, {available: tokenDepositAmount, reserved: 0}));
        });

        it("should insert a new sell order, change the first order reference and update the best ask reference", () => {
            const order = sell(100, 5);
            const orderState = {prev: 0, next: 1};
            const orderbookState = {firstOrder: 2, bestBid: 0, bestAsk: 2, lastOrder: 1};
            let newBestAskWatcher;
            let newAskWatcher;
            return placeOrder(sell(110, 5))
                .then(() => {
                    newBestAskWatcher = exchange.NewBestAsk();
                    newAskWatcher = exchange.NewAsk();
                })
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 2, next: 0}))
                .then(() => checkNewAskOrBidEvent(newBestAskWatcher, {price: order.price}))
                .then(() => checkNewAskOrBidEvent(newAskWatcher, {price: order.price}));
        });

        it("should insert a new buy order, change the last order reference and update the best bid reference", () => {
            const order = buy(110, 5);
            const orderState = {prev: 1, next: 0};
            const orderbookState = {firstOrder: 1, bestBid: 2, bestAsk: 0, lastOrder: 2};
            let newBestBidWatcher;
            let newBidWatcher;
            return placeOrder(buy(100, 5))
                .then(() => {
                    newBestBidWatcher = exchange.NewBestBid();
                    newBidWatcher = exchange.NewBid();
                })
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 0, next: 2}))
                .then(() => checkNewAskOrBidEvent(newBestBidWatcher, {price: order.price}))
                .then(() => checkNewAskOrBidEvent(newBidWatcher, {price: order.price}));
        });

        it("should insert a new buy order as first of buy orders", () => {
            const order = buy(50, 5);
            const orderState = {prev: 0, next: 1};
            const orderbookState = {firstOrder: 2, bestBid: 1, bestAsk: 0, lastOrder: 1};
            return placeOrder(buy(100, 5))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 2, next: 0}));
        });

        it("should insert a new sell order as last of sell orders", () => {
            const order = sell(100, 5);
            const orderState = {prev: 1, next: 0};
            const orderbookState = {firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 2};
            return placeOrder(sell(50, 5))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 0, next: 2}));
        });

        it("should insert a new buy order between two others", () => {
            const order = buy(110, 5);
            const orderState = {prev: 1, next: 2};
            const orderbookState = {firstOrder: 1, bestBid: 2, bestAsk: 0, lastOrder: 2};
            return placeOrder(buy(100, 5))
                .then(() => placeOrder(buy(120, 5)))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 0, next: 3}))
                .then(() => checkOrder(2, {prev: 3, next: 0}));
        });

        it("should insert a new sell order between two others", () => {
            const order = sell(110, 5);
            const orderState = {prev: 1, next: 2};
            const orderbookState = {firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 2};
            return placeOrder(sell(100, 5))
                .then(() => placeOrder(sell(120, 5)))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 0, next: 3}))
                .then(() => checkOrder(2, {prev: 3, next: 0}));
        });

        it("should insert a new sell order after the best buy order", () => {
            const order = sell(130, 5);
            const orderState = {prev: 1, next: 0};
            const orderbookState = {firstOrder: 1, bestBid: 1, bestAsk: 2, lastOrder: 2};
            return placeOrder(buy(100, 5))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 0, next: 2}));
        });

        it("should insert a new buy order before the best sell order", () => {
            const order = buy(100, 5);
            const orderState = {prev: 0, next: 1};
            const orderbookState = {firstOrder: 2, bestBid: 2, bestAsk: 1, lastOrder: 1};
            return placeOrder(sell(130, 5))
                .then(() => testOrder(order, orderState, orderbookState))
                .then(() => checkOrder(1, {prev: 2, next: 0}));
        });

        it("should cancel a sell order from the middle of sell orders", () => {
            const order = sell(110, 5);
            const orderState = {prev: 1, next: 0};
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(sell(100, 5))
                .then(() => placeOrder(order))
                .then(() => placeOrder(sell(120, 5)))
                .then(() => cancelOrder(2, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: 2}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {prev: 0, next: 3}))
                .then(() => checkOrder(3, {prev: 1, next: 0}))
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 3}));
        });

        it("should cancel a buy order from the middle of buy orders", () => {
            const order = buy(110, 5);
            const orderState = {prev: 1, next: 0};
            const cancelOrderWatcher = exchange.NewCancelOrder();
            return placeOrder(buy(100, 5))
                .then(() => placeOrder(order))
                .then(() => placeOrder(buy(120, 5)))
                .then(() => cancelOrder(2, order.from))
                .then(() => checkCancelOrderEvent(cancelOrderWatcher, {id: 2}))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {prev: 0, next: 3}))
                .then(() => checkOrder(3, {prev: 1, next: 0}))
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 3, bestAsk: 0, lastOrder: 3}));
        });

        it("should determine correct best bid after adding different orders", () => {
            let bestBid;
            let bestBidPrice
            return placeOrder(buy(2, 1))
                .then(() => placeOrder(buy(3, 1)))
                .then(() => placeOrder(buy(4, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestBid = orderbook[1].toFixed()}))
                .then(() => exchange.getOrder(bestBid).then(order => {bestBidPrice = order[0].toFixed()}))
                .then(() => assert.equal(bestBidPrice, 4000000000000000000))
        });

        it("should determine correct best bid after adding identical orders", () => {
            let bestBid;
            let bestBidPrice
            return placeOrder(buy(2, 1))
                .then(() => placeOrder(buy(2, 1)))
                .then(() => placeOrder(buy(4, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestBid = orderbook[1].toFixed()}))
                .then(() => exchange.getOrder(bestBid).then(order => {bestBidPrice = order[0].toFixed()}))
                .then(() => assert.equal(bestBidPrice, 4000000000000000000))
        });

        it("should determine correct best ask after adding different orders", () => {
            let bestAsk;
            let bestAskPrice
            return placeOrder(sell(4, 1))
                .then(() => placeOrder(sell(3, 1)))
                .then(() => placeOrder(sell(2, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestAsk = orderbook[2].toFixed()}))
                .then(() => exchange.getOrder(bestAsk).then(order => {bestAskPrice = order[0].toFixed()}))
                .then(() => assert.equal(bestAskPrice, 2000000000000000000))
        });

        it("should determine correct best ask after adding identical orders", () => {
            let bestAsk;
            let bestAskPrice
            return placeOrder(sell(4, 1))
                .then(() => placeOrder(sell(4, 1)))
                .then(() => placeOrder(sell(2, 1)))
                .then(() => exchange.getOrderBookInfo(baseToken.address, tradeToken.address).then(orderbook => {bestAsk = orderbook[2].toFixed()}))
                .then(() => exchange.getOrder(bestAsk).then(order => {bestAskPrice = order[0].toFixed()}))
                .then(() => assert.equal(bestAskPrice, 2000000000000000000))
        });
    });

    describe("Order Matching", function() {
        it("the best buy order should be partially filled by a new sell order", () => {
            const buyOrder = buy(100, 5);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{bidId: 1, askId: 2, side: false, amount: sellOrder.amount, price: buyOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {amount: buyOrder.amount - sellOrder.amount, prev: 0, next: 0}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: sellOrder.amount * fromWei(buyOrder.price), reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount - buyOrder.total,
                        reserved: fromWei(buyOrder.price) * (buyOrder.amount - sellOrder.amount)
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 1, bestAsk: 0, lastOrder: 1}));
        });

        it("the best sell order should be partially filled by a new buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 5);
            const tradeEventsStates = [{bidId: 2, askId: 1, side: true, amount: buyOrder.amount, price: sellOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(2, undefined))
                .then(() => checkOrder(1, {amount: sellOrder.amount - buyOrder.amount, prev: 0, next: 0}))
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
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 1}));
        });

        it("a new sell order should be partially filled by the best buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 5);
            const tradeEventsStates = [{bidId: 1, askId: 2, side: false, amount: buyOrder.amount, price: buyOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrder)
                .then(() => placeOrder(sellOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, {amount: sellOrder.amount - buyOrder.amount, prev: 0, next: 0}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: sellOrder.amount - buyOrder.amount}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: buyOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: buyOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {available: tokenDepositAmount - buyOrder.total, reserved: 0}))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({firstOrder: 2, bestBid: 0, bestAsk: 2, lastOrder: 2}));
        });

        it("a new buy order should be partially filled by the best sell order", () => {
            const buyOrder = buy(100, 5);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{bidId: 2, askId: 1, side: true, amount: sellOrder.amount, price: sellOrder.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrder)
                .then(() => placeOrder(buyOrder))
                .then(() => checkOrder(1, undefined))
                .then(() => checkOrder(2, {amount: buyOrder.amount - sellOrder.amount, prev: 0, next: 0}))
                .then(() => checkBalance(tradeToken.address, sellOrder.from, {available: tokenDepositAmount - sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, sellOrder.from, {available: sellOrder.total, reserved: 0}))
                .then(() => checkBalance(tradeToken.address, buyOrder.from, {available: sellOrder.amount, reserved: 0}))
                .then(() => checkBalance(baseToken.address, buyOrder.from, {
                        available: tokenDepositAmount - buyOrder.total + fromWei(buyOrder.price.minus(sellOrder.price)) * sellOrder.amount,
                        reserved: fromWei(buyOrder.price) * (buyOrder.amount - sellOrder.amount)
                    }))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsStates))
                .then(() => checkOrderbook({firstOrder: 2, bestBid: 2, bestAsk: 0, lastOrder: 2}));
        });

        it("a new sell order should be completely filled and completely fill the best buy order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{bidId: 1, askId: 2, side: false, amount: sellOrder.amount, price: buyOrder.price}];
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
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}));
        });

        it("a new buy order should be completely filled and completely fill the best sell order", () => {
            const buyOrder = buy(100, 2);
            const sellOrder = sell(90, 2);
            const tradeEventsStates = [{bidId: 2, askId: 1, side: true, amount: sellOrder.amount, price: sellOrder.price}];
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
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}));
        });

        it("a new sell order should completely fill several buy orders", () => {
            let [buy1, buy2, buy3] = [buy(100, 2), buy(110, 3), buy(120, 4)]
            const sellOrder = sell(105, 10);
            const tradeEventsStates = [
                {bidId: 3, askId: 4, side: false, amount: buy3.amount, price: buy3.price},
                {bidId: 2, askId: 4, side: false, amount: buy2.amount, price: buy2.price}
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
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 1, bestAsk: 4, lastOrder: 4}));
        });

        it("a new buy order should completely fill several sell orders", () => {
            let [sell1, sell2, sell3] = [sell(120, 4), sell(110, 3), sell(100, 2)]
            const buyOrder = buy(115, 10);
            const tradeEventsStates = [
                {bidId: 4, askId: 3, side: true, amount: sell3.amount, price: sell3.price},
                {bidId: 4, askId: 2, side: true, amount: sell2.amount, price: sell2.price}
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
                .then(() => checkOrderbook({firstOrder: 4, bestBid: 4, bestAsk: 1, lastOrder: 1}));
        });

        it("sell orders should match same priced buy orders in FIFO fashion", () => {
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(90, 5);
            const buyOrderThree = buy(90, 5);
            const sellOrderOne = sell(90, 5);
            const sellOrderTwo = sell(90, 5);
            const sellOrderThree = sell(90, 5);
            const tradeEventsOne = [{bidId: 1, askId: 4, side: false, amount: buyOrderOne.amount, price: buyOrderOne.price}];
            const tradeEventsTwo = [{bidId: 2, askId: 5, side: false, amount: buyOrderTwo.amount, price: buyOrderTwo.price}];
            const tradeEventsThree = [{bidId: 3, askId: 6, side: false, amount: buyOrderThree.amount, price: buyOrderThree.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(buyOrderOne)
                .then(() => placeOrder(buyOrderTwo))
                .then(() => placeOrder(buyOrderThree))
                .then(() => checkOrderbook({firstOrder: 3, bestBid: 1, bestAsk: 0, lastOrder: 1}))
                .then(() => placeOrder(sellOrderOne))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsOne))
                .then(() => checkOrderbook({firstOrder: 3, bestBid: 2, bestAsk: 0, lastOrder: 2}))
                .then(() => placeOrder(sellOrderTwo))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsTwo))
                .then(() => checkOrderbook({firstOrder: 3, bestBid: 3, bestAsk: 0, lastOrder: 3}))
                .then(() => placeOrder(sellOrderThree))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsThree))
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}))
        })

        it("buy orders should match same priced sell orders in FIFO fashion", () => {
            const sellOrderOne = sell(90, 5);
            const sellOrderTwo = sell(90, 5);
            const sellOrderThree = sell(90, 5);
            const buyOrderOne = buy(90, 5);
            const buyOrderTwo = buy(90, 5);
            const buyOrderThree = buy(90, 5);
            const tradeEventsOne = [{bidId: 4, askId: 1, side: true, amount: sellOrderOne.amount, price: sellOrderOne.price}];
            const tradeEventsTwo = [{bidId: 5, askId: 2, side: true, amount: sellOrderTwo.amount, price: sellOrderTwo.price}];
            const tradeEventsThree = [{bidId: 6, askId: 3, side: true, amount: sellOrderThree.amount, price: sellOrderThree.price}];
            const newTradeWatcher = exchange.NewTrade();
            return placeOrder(sellOrderOne)
                .then(() => placeOrder(sellOrderTwo))
                .then(() => placeOrder(sellOrderThree))
                .then(() => checkOrderbook({firstOrder: 1, bestBid: 0, bestAsk: 1, lastOrder: 3}))
                .then(() => placeOrder(buyOrderOne))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsOne))
                .then(() => checkOrderbook({firstOrder: 2, bestBid: 0, bestAsk: 2, lastOrder: 3}))
                .then(() => placeOrder(buyOrderTwo))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsTwo))
                .then(() => checkOrderbook({firstOrder: 3, bestBid: 0, bestAsk: 3, lastOrder: 3}))
                .then(() => placeOrder(buyOrderThree))
                .then(() => checkTradeEvents(newTradeWatcher, tradeEventsThree))
                .then(() => checkOrderbook({firstOrder: 0, bestBid: 0, bestAsk: 0, lastOrder: 0}))
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
                .then(() => checkGetOrderbookBids([{amount: buyOrderThree.amount - sellOrder.amount, price: buyOrderThree.price}, {amount: buyOrderTwo.amount, price: buyOrderTwo.price}, {amount: buyOrderOne.amount, price: buyOrderOne.price}]))
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
                .then(() => checkGetOrderbookBids([{amount: buyOrderThree.amount - sellOrder.amount, price: buyOrderThree.price}, {amount: buyOrderTwo.amount.plus(buyOrderOne.amount), price: buyOrderTwo.price}]))
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
                .then(() => checkGetOrderbookAsks([{amount: sellOrderThree.amount - buyOrder.amount, price: sellOrderThree.price}, {amount: sellOrderTwo.amount, price: sellOrderTwo.price}, {amount: sellOrderOne.amount, price: sellOrderOne.price}]))
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
                .then(() => checkGetOrderbookAsks([{amount: sellOrderThree.amount - buyOrder.amount, price: sellOrderThree.price}, {amount: sellOrderTwo.amount.plus(sellOrderOne.amount), price: sellOrderTwo.price}]))
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
              {amount: buy12.amount * 3, price: buy12.price},
              {amount: buy11.amount, price: buy11.price},
              {amount: buy10.amount * 3, price: buy10.price},
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
              {amount: ask12.amount * 2, price: ask12.price},
              {amount: ask13.amount * 3, price: ask13.price},
              {amount: ask14.amount * 2, price: ask14.price},
              {amount: ask15.amount * 3, price: ask15.price},
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
    })

    describe("Upgrade", () => {
        it("existing orders should remain after upgrade ", async () => {
            // GIVEN
            const sellOrder = sell(105, 10)
            await placeOrder(sellOrder)

            // THEN
            const newExchange = await Exchange.new({ gas: 10000000 })
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
                'baseToken': etherAddress,
                'tradeToken': tradeToken.address,
                'amount': toWei(0.0001),
                'price': toWei(price),
                'from': buyer
            }
        })

        it('should be able to interact with the exchange via an intermediate contract', async () => {
            const exchangeEtherBalanceBefore = await web3.eth.getBalance(exchange.address)

            const newOrderEventWatcher = exchange.NewOrder();
            const cancelOrderEventWatcher = exchange.NewCancelOrder();
            await fallbackTrap.buy(order.baseToken, order.tradeToken, fallbackTrap.address, order.amount, order.price, { from: order.from, value: order.amount * price, gasPrice: 0 })
            const id = newOrderEventWatcher.get()[0].args.id;
            await fallbackTrap.cancelOrder(id, { from: buyer, gasPrice:0, value: 0 });
            checkCancelOrderEvent(cancelOrderEventWatcher, {id})

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
            checkCancelOrderEvent(cancelOrderEventWatcher, {id})

            assert.equal(order.amount * price, (await web3.eth.getBalance(fallbackTrap.address)).toString())
            assert.equal(exchangeEtherBalanceBefore.toString(), (await web3.eth.getBalance(exchange.address)).toString())
        })
    });

    async function deployExchange() {
        baseToken = await Token.new()
        tradeToken = await Token.new()
        let exchangeInstance = await Exchange.new({ gas: 10000000 })
        exchangeProxy = await ExchangeProxy.new(exchangeInstance.address, { from: proxyOwner })
        exchange = await Exchange.at(exchangeProxy.address)
        await exchange.initialize({ from: exchangeOwner })
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
            orderState = {price: 0, sell: false, amount: 0, prev: 0, next: 0};
        }

        return exchange.getOrder(id)
            .then(order => {
                if (orderState.price != undefined)
                    assert.equal(order[0].toFixed(), orderState.price, "price");
                if (orderState.sell != undefined)
                    assert.equal(order[1], orderState.sell, "order type");
                if (orderState.amount != undefined)
                    assert.equal(order[2].toFixed(), orderState.amount, "amount");
                // if (orderState.next != undefined)
                //     assert.equal(order[3].toFixed(), orderState.next, "next order");
                // if (orderState.prev != undefined)
                //     assert.equal(order[4].toFixed(), orderState.prev, "prev order");
            });
    }

    function checkOrderbook(orderbookState) {
        return exchange.getOrderBookInfo(baseToken.address, tradeToken.address)
            .then(orderbook => {
                // assert.equal(orderbook[0].toFixed(), orderbookState.firstOrder, "first order");
                assert.equal(orderbook[1].toFixed(), orderbookState.bestBid, "best bid");
                assert.equal(orderbook[2].toFixed(), orderbookState.bestAsk, "best ask");
                // assert.equal(orderbook[3].toFixed(), orderbookState.lastOrder, "last order");
            });
    }

    function checkGetOrderbookAsks(expectedAsks) {
        return exchange.getOrderbookAsks(baseToken.address, tradeToken.address)
        .then(result => {
            const asks = parseGetOrderbookResult(result);
            assert.equal(asks.items, expectedAsks.length);
            for (let i = 0; i < asks.items; i++) {
                assert.equal(asks.price[i], expectedAsks[i].price);
                assert.equal(asks.amount[i], expectedAsks[i].amount);
            }
        });
    }

    function checkGetOrderbookBids(expectedBids) {
        return exchange.getOrderbookBids(baseToken.address, tradeToken.address)
        .then(result => {
            const bids = parseGetOrderbookResult(result);
            assert.equal(bids.items, expectedBids.length);
            for (let i = 0; i < bids.items; i++) {
                assert.equal(bids.price[i], expectedBids[i].price);
                assert.equal(bids.amount[i], expectedBids[i].amount);
            }
        });
    }

    function checkTradeEvents(watcher, eventsState) {
        let events = watcher.get();
        assert.equal(events.length, eventsState.length);

        for (let i = 0; i < events.length; i++) {
            let event = events[i].args;
            let state = eventsState[i];
            assert.equal(event.baseToken, baseToken.address);
            assert.equal(event.tradeToken, tradeToken.address);
            assert.equal(event.bidId, state.bidId);
            assert.equal(event.askId, state.askId);
            assert.equal(event.side, state.side);
            assert.equal(event.amount.toString(), state.amount.toString());
            assert.equal(event.price.toString(), state.price.toString());
        }
    }

    function checkNewAskOrBidEvent(watcher, expectedState) {
        let events = watcher.get();
        assert.equal(events.length, 1);

        let event = events[0].args;
        assert.equal(event.baseToken, baseToken.address);
        assert.equal(event.tradeToken, tradeToken.address);
        assert.equal(event.price.toString(), expectedState.price.toString());
    }

    function checkNewOrderEvent(watcher, expectedState) {
        let events = watcher.get();
        assert.equal(events.length, 1);

        let event = events[0].args;
        assert.equal(event.baseToken, baseToken.address);
        assert.equal(event.tradeToken, tradeToken.address);
        assert.equal(event.owner, expectedState.from);
        assert.equal(event.id, expectedState.id);
        assert.equal(event.side, expectedState.side);
        assert.equal(event.price.toString(), expectedState.price.toString());
        assert.equal(event.amount.toString(), expectedState.amount.toString());
    }

    function checkCancelOrderEvent(watcher, expectedState) {
        let events = watcher.get();
        assert.equal(events.length, 1);

        let event = events[0].args;
        assert.equal(event.id.toString(), expectedState.id.toString());
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

    function testOrder(order, orderItemState, orderbookState) {
        return placeOrder(order)
            .then(id => {
                let orderState;
                if (orderItemState != undefined) {
                    orderState = {
                        price: order.price,
                        sell: order.sell,
                        amount: orderItemState.amount != undefined ? orderItemState.amount : order.amount,
                        prev: orderItemState.prev,
                        next: orderItemState.next
                    };
                }
                return checkOrder(id, orderState);
            }).then(() => {
                return checkOrderbook(orderbookState);
            });
    }

    function parseGetOrderbookResult(result) {
        return {
            price: result[0].map(t => t.toNumber()),
            isSell: result[1],
            amount: result[2].map(t => t.toNumber()),
            id: result[3].map(t => t.toNumber()),
            items: result[4].toNumber()
        }
    }

});
