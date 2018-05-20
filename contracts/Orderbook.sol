pragma solidity ^0.4.18;

import "./Manageable.sol";
import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract Orderbook is Manageable {
  using SafeMath for uint256;

  struct Order {
    address creator;
    address tokenGive;
    address tokenGet;
    uint256 amountGive;
    uint256 amountGet;
  }

  uint256 public numOfOrders = 0;
  mapping(uint256 => Order) public orders;

  function newOrder(address creator, address tokenGive, address tokenGet, uint256 amountGive, uint256 amountGet) public onlyManager returns (uint256 orderId) {
    orderId = numOfOrders++;
    orders[orderId] = Order(creator, tokenGive, tokenGet, amountGive, amountGet);
  }

  function getCreator(uint256 orderId) view public returns (address) {
    return orders[orderId].creator;
  }

  function getTokenGive(uint256 orderId) view public returns (address) {
    return orders[orderId].tokenGive;
  }

  function getTokenGet(uint256 orderId) view public returns (address) {
    return orders[orderId].tokenGet;
  }

  function getAmountGive(uint256 orderId) view public returns (uint256) {
    return orders[orderId].amountGive;
  }

  function getAmountGet(uint256 orderId) view public returns (uint256) {
    return orders[orderId].amountGet;
  }

  function updateAmountGive(uint256 orderId, uint256 newAmountGive) public onlyManager {
    orders[orderId].amountGive = newAmountGive;
  }

  function updateAmountGet(uint256 orderId, uint256 newAmountGet) public onlyManager {
    orders[orderId].amountGet = newAmountGet;
  }
}
