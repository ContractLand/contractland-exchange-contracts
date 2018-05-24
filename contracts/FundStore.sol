pragma solidity ^0.4.18;

import "./Manageable.sol";
import "./ERC20Token.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract FundStore is Manageable {
  using SafeMath for uint256;

  // mapping of account address to mapping of token address to amount
  mapping(address => mapping(address => uint256)) public balances;
  address private etherAddress = 0x0;

  event Deposit(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);
  event Withdraw(address indexed _token, address indexed _owner, uint256 _amount, uint256 _time);

  function balanceOf(address user, address token) view public returns (uint256) {
    return balances[user][token];
  }

  function transfer(address from, address to, address token, uint256 value) public onlyManager returns (bool) {
    require(to != address(0));
    require(value <= balances[from][token]);

    balances[from][token] = balances[from][token].sub(value);
    balances[to][token] = balances[to][token].add(value);
    return true;
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
}
