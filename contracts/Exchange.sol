pragma solidity ^0.4.18;

import "./FundStore.sol";
import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Exchange
 * @dev On-Chain ERC20 token exchange
 */
contract Exchange {
  using SafeMath for uint256;

  struct Order {
    address creator;
    address tokenGive;
    address tokenGet;
    uint256 amountGive;
    uint256 amountGet;
  }

  FundStore fundStore;

  uint256 public numOfOrders = 0;
  mapping(uint256 => Order) public orderBook;

  event NewOrder(uint256 _id, address indexed _creator, address indexed _tokenGive, address indexed _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _time);
  event OrderCancelled(uint256 indexed _id, uint256 _time);
  event OrderFulfilled(uint256 indexed _id, uint256 _time);
  event Trade(address indexed _taker, address indexed _maker, uint256 indexed _orderId, uint256 _amountFilled, uint256 _amountReceived, uint256 _time);

  function Exchange(address _fundStore) public {
      fundStore = FundStore(_fundStore);
  }

  function balanceOf(address token, address user) view public returns (uint256) {
    return fundStore.balanceOf(user, token);
  }

  function createOrder(address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet) public returns (uint256 orderId) {
    require(amountGive != 0 && amountGet != 0);
    require(tokenGive != tokenGet);
    require(fundStore.balanceOf(msg.sender, tokenGive) >= amountGive);

    orderId = numOfOrders++;
    orderBook[orderId] = Order(msg.sender, tokenGive, tokenGet, amountGive, amountGet);
    fundStore.setBalance(msg.sender, tokenGive, fundStore.balanceOf(msg.sender, tokenGive).sub(amountGive));

    NewOrder(orderId, msg.sender, tokenGive, tokenGet, amountGive, amountGet, now);
  }

  function getOrder(uint256 orderId) public view returns (address,
                                                          address,
                                                          address,
                                                          uint256,
                                                          uint256) {
    return (orderBook[orderId].creator,
            orderBook[orderId].tokenGive,
            orderBook[orderId].tokenGet,
            orderBook[orderId].amountGive,
            orderBook[orderId].amountGet);
  }

  function cancelOrder(uint256 orderId) public {
    Order storage order = orderBook[orderId];
    require(order.amountGive != 0);
    require(msg.sender == order.creator);

    fundStore.setBalance(msg.sender, order.tokenGive, fundStore.balanceOf(msg.sender, order.tokenGive).add(order.amountGive));
    order.amountGive = 0;

    OrderCancelled(orderId, now);
  }

  function executeOrder(uint256 orderId, uint256 amountFill, bool allowPartialFill) public {
    require(orderId < numOfOrders);
    require(amountFill != 0);

    Order storage order = orderBook[orderId];
    require(msg.sender != order.creator);
    require(order.amountGive > 0);

    if (order.amountGive < amountFill) {
      require(allowPartialFill);
      amountFill = order.amountGive;
    }

    uint256 tokenGetAmount = amountFill.mul(order.amountGet).div(order.amountGive);
    require(fundStore.balanceOf(msg.sender, order.tokenGet) >= tokenGetAmount);

    /*uint256 fee = amount.div(feeMultiplier);*/
    fundStore.setBalance(order.creator, order.tokenGet, fundStore.balanceOf(order.creator, order.tokenGet).add(tokenGetAmount));
    fundStore.setBalance(msg.sender, order.tokenGet, fundStore.balanceOf(msg.sender, order.tokenGet).sub(tokenGetAmount));
    fundStore.setBalance(msg.sender, order.tokenGive, fundStore.balanceOf(msg.sender, order.tokenGive).add(amountFill));/*.sub(fee);*/
    /*balances[order.owner][order.sellToken]    = balances[order.owner][order.sellToken].add(fee);*/

    order.amountGive = order.amountGive.sub(amountFill);

    Trade(msg.sender, order.creator, orderId, amountFill, tokenGetAmount, now);
    if (order.amountGive == 0) { OrderFulfilled(orderId, now); }
  }

  function batchExecute(uint256[] orderIds, uint256[] amountFills, bool allowPartialFill) public {
    for (uint i = 0; i < orderIds.length; i++) {
      executeOrder(orderIds[i], amountFills[i], allowPartialFill);
    }
  }
}
