pragma solidity ^0.4.23;

import "./ERC827Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import 'zos-lib/contracts/migrations/Initializable.sol';

/**
 * @title Exchange
 * @dev On-Chain ERC20 token exchange
 */
contract Exchange is Initializable, Pausable {
  using SafeMath for uint256;

  // ***Start of V1.0.0 storage variables***
  struct Order {
    address creator;
    address tokenGive;
    address tokenGet;
    uint256 amountGive;
    uint256 amountGet;
  }

  uint256 public numOfOrders = 0;
  mapping(uint256 => Order) public orderBook;
  // ***End of V1.0.0 storage variables***

  event NewOrder(uint256 _id, address indexed _creator, address indexed _tokenGive, address indexed _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _time);
  event OrderCancelled(uint256 indexed _id, uint256 _time);
  event OrderFulfilled(uint256 indexed _id, uint256 _time);
  event Trade(address indexed _taker, address indexed _maker, uint256 indexed _orderId, uint256 _amountFilled, uint256 _amountReceived, uint256 _time);

  // Initialize owner for proxy
  function initialize() isInitializer public {
    owner = msg.sender;
  }

  function createOrder(address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet, address maker) public whenNotPaused returns (uint256 orderId) {
    require(amountGive != 0 && amountGet != 0);
    require(tokenGive != tokenGet);

    require(ERC827Token(tokenGive).transferFrom(maker, this, amountGive));

    orderId = numOfOrders++;
    orderBook[orderId] = Order(maker, tokenGive, tokenGet, amountGive, amountGet);

    NewOrder(orderId, maker, tokenGive, tokenGet, amountGive, amountGet, now);
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

  function cancelOrder(uint256 orderId) public whenNotPaused {
    Order storage order = orderBook[orderId];
    require(order.amountGive != 0);
    require(msg.sender == order.creator);

    require(ERC827Token(order.tokenGive).transfer(msg.sender, order.amountGive));

    order.amountGive = 0;

    OrderCancelled(orderId, now);
  }

  function executeOrder(uint256 orderId, uint256 amountFill, bool allowPartialFill) public whenNotPaused {
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

    // Transfer tokenGet from taker to maker
    require(ERC827Token(order.tokenGet).transferFrom(msg.sender, order.creator, tokenGetAmount));
    // Transfer tokenGive to taker
    require(ERC827Token(order.tokenGive).transfer(msg.sender, amountFill));

    order.amountGive = order.amountGive.sub(amountFill);
    order.amountGet = order.amountGet.sub(tokenGetAmount);

    Trade(msg.sender, order.creator, orderId, amountFill, tokenGetAmount, now);
    if (order.amountGive == 0) { OrderFulfilled(orderId, now); }
  }

  function batchExecute(uint256[] orderIds, uint256[] amountFills, bool allowPartialFill) public {
    for (uint i = 0; i < orderIds.length; i++) {
      executeOrder(orderIds[i], amountFills[i], allowPartialFill);
    }
  }
}
