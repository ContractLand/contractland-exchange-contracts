pragma solidity ^0.4.18;

import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Exchange
 * @dev On-Chain ERC20 token exchange
 */
contract Exchange {
  using SafeMath for uint256;

  address private etherAddress = 0x0;

  // mapping of account address to mapping of token address to amount
  mapping(address => mapping(address => uint256)) public balances;

  event Deposit(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);
  event Withdrawal(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);

  function balanceOf(address token, address user) view public returns (uint256) {
    return balances[user][token];
  }

  function deposit() public payable {
    require(msg.value != 0);
    balances[msg.sender][etherAddress] = balances[msg.sender][etherAddress].add(msg.value);
    Deposit(etherAddress, msg.sender, msg.value, now);
  }

  function depositToken(address token, uint256 amount) {
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

    Withdrawal(token, msg.sender, amount, now);
  }

  function createOrder(address sellToken, address buyToken, uint256 amount) public {
    require(balances[msg.sender][sellToken] >= amount);
  }

}
