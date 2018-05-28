pragma solidity ^0.4.18;

import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title Exchange
 * @dev On-Chain ERC20 token exchange
 */
contract Exchange is Pausable {
  using SafeMath for uint256;

  struct Order {
    address creator;
    address tokenGive;
    address tokenGet;
    uint256 amountGive;
    uint256 amountGet;
  }

  address private etherAddress = 0x0;

  // mapping of account address to mapping of token address to amount
  mapping(address => mapping(address => uint256)) public balances;

  uint256 public numOfOrders = 0;
  mapping(uint256 => Order) public orderBook;

  event Deposit(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);
  event Withdraw(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);
  event NewOrder(uint256 _id, address indexed _creator, address indexed _tokenGive, address indexed _tokenGet, uint256 _amountGive, uint256 _amountGet, uint256 _time);
  event OrderCancelled(uint256 indexed _id, uint256 _time);
  event OrderFulfilled(uint256 indexed _id, uint256 _time);
  event Trade(address indexed _taker, address indexed _maker, uint256 indexed _orderId, uint256 _amountFilled, uint256 _amountReceived, uint256 _time);

  function balanceOf(address token, address user) view public returns (uint256) {
    return balances[user][token];
  }

  function deposit() public payable {
    require(msg.value != 0);
    balances[msg.sender][etherAddress] = balances[msg.sender][etherAddress].add(msg.value);
    Deposit(etherAddress, msg.sender, msg.value, now);
  }

  function depositToken(address token, uint256 amount) public {
    require(amount != 0);
    require(ERC20Token(token).transferFrom(msg.sender, this, amount));
    balances[msg.sender][token] = balances[msg.sender][token].add(amount);
    Deposit(token, msg.sender, amount, now);
  }

  function withdraw(address token, uint256 amount) public {
    require(amount != 0);
    require(amount <= balances[msg.sender][token]);

    balances[msg.sender][token] = balances[msg.sender][token].sub(amount);
    if (token == etherAddress) {
      msg.sender.transfer(amount);
    } else {
      require(ERC20Token(token).transfer(msg.sender, amount));
    }

    Withdraw(token, msg.sender, amount, now);
  }

  function createOrder(address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet) public whenNotPaused returns (uint256 orderId) {
    require(amountGive != 0 && amountGet != 0);
    require(tokenGive != tokenGet);
    require(balances[msg.sender][tokenGive] >= amountGive);

    orderId = numOfOrders++;
    orderBook[orderId] = Order(msg.sender, tokenGive, tokenGet, amountGive, amountGet);
    balances[msg.sender][tokenGive] = balances[msg.sender][tokenGive].sub(amountGive);

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

  function cancelOrder(uint256 orderId) public whenNotPaused {
    Order storage order = orderBook[orderId];
    require(order.amountGive != 0);
    require(msg.sender == order.creator);

    balances[msg.sender][order.tokenGive] = balances[msg.sender][order.tokenGive].add(order.amountGive);
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
    require(balances[msg.sender][order.tokenGet] >= tokenGetAmount);

    /*uint256 fee = amount.div(feeMultiplier);*/
    balances[order.creator][order.tokenGet]   = balances[order.creator][order.tokenGet].add(tokenGetAmount);
    balances[msg.sender][order.tokenGet]      = balances[msg.sender][order.tokenGet].sub(tokenGetAmount);
    balances[msg.sender][order.tokenGive]     = balances[msg.sender][order.tokenGive].add(amountFill);/*.sub(fee);*/
    /*balances[order.owner][order.sellToken]    = balances[order.owner][order.sellToken].add(fee);*/

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
