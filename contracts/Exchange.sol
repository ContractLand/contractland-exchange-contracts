pragma solidity ^0.4.18;

import "./FundStore.sol";
import "./Orderbook.sol";
import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Exchange
 * @dev On-Chain ERC20 token exchange
 */
contract Exchange {
  using SafeMath for uint256;

  FundStore fundStore;
  Orderbook orderbook;

  event NewOrder(uint256 _id, address indexed _creator, address indexed _tokenGive, address indexed _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _time);
  event OrderCancelled(uint256 indexed _id, uint256 _time);
  event OrderFulfilled(uint256 indexed _id, uint256 _time);
  event Trade(address indexed _taker, address indexed _maker, uint256 indexed _orderId, uint256 _amountFilled, uint256 _amountReceived, uint256 _time);

  function Exchange(address _fundStore, address _orderbook) public {
      fundStore = FundStore(_fundStore);
      orderbook = Orderbook(_orderbook);
  }

  function balanceOf(address token, address user) view public returns (uint256) {
    return fundStore.balanceOf(user, token);
  }

  function createOrder(address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet) public returns (uint256 orderId) {
    require(amountGive != 0 && amountGet != 0);
    require(tokenGive != tokenGet);
    require(fundStore.balanceOf(msg.sender, tokenGive) >= amountGive);

    orderId = orderbook.newOrder(msg.sender, tokenGive, tokenGet, amountGive, amountGet);
    fundStore.transfer(msg.sender, orderbook, tokenGive, amountGive);

    NewOrder(orderId, msg.sender, tokenGive, tokenGet, amountGive, amountGet, now);
  }

  function getOrder(uint256 orderId) public view returns (address creator,
                                                          address tokenGive,
                                                          address tokenGet,
                                                          uint256 amountGive,
                                                          uint256 amountGet) {
    return (orderbook.orders(orderId));
  }

  function cancelOrder(uint256 orderId) public {
    uint256 orderAmountGive = orderbook.getAmountGive(orderId);
    address orderTokenGive = orderbook.getTokenGive(orderId);
    address orderCreator = orderbook.getCreator(orderId);

    require(orderAmountGive != 0);
    require(msg.sender == orderCreator);

    fundStore.transfer(orderbook, msg.sender, orderTokenGive, orderAmountGive);
    orderbook.setAmountGive(orderId, 0);

    OrderCancelled(orderId, now);
  }

  function executeOrder(uint256 orderId, uint256 amountFill, bool allowPartialFill) public {
    require(orderId < orderbook.numOfOrders());
    require(amountFill != 0);

    address orderCreator = orderbook.getCreator(orderId);
    address orderTokenGive = orderbook.getTokenGive(orderId);
    address orderTokenGet = orderbook.getTokenGet(orderId);
    uint256 orderAmountGive = orderbook.getAmountGive(orderId);
    uint256 orderAmountGet= orderbook.getAmountGet(orderId);

    require(msg.sender != orderCreator);
    require(orderAmountGive > 0);

    if (orderAmountGive < amountFill) {
      require(allowPartialFill);
      amountFill = orderAmountGive;
    }

    uint256 tokenGetAmount = amountFill.mul(orderAmountGet).div(orderAmountGive);
    require(fundStore.balanceOf(msg.sender, orderTokenGet) >= tokenGetAmount);

    /*uint256 fee = amount.div(feeMultiplier);*/
    fundStore.transfer(msg.sender, orderCreator, orderTokenGet, tokenGetAmount);
    fundStore.transfer(orderbook, msg.sender, orderTokenGive, amountFill);/*.sub(fee);*/
    /*balances[order.owner][order.sellToken]    = balances[order.owner][order.sellToken].add(fee);*/

    uint256 newAmountGive = orderAmountGive.sub(amountFill);
    uint256 newAmountGet = orderAmountGet.sub(tokenGetAmount);
    orderbook.setAmountGive(orderId, newAmountGive);
    orderbook.setAmountGet(orderId, newAmountGet);

    Trade(msg.sender, orderCreator, orderId, amountFill, tokenGetAmount, now);
    if (newAmountGive == 0) { OrderFulfilled(orderId, now); }
  }

  function batchExecute(uint256[] orderIds, uint256[] amountFills, bool allowPartialFill) public {
    for (uint i = 0; i < orderIds.length; i++) {
      executeOrder(orderIds[i], amountFills[i], allowPartialFill);
    }
  }
}
