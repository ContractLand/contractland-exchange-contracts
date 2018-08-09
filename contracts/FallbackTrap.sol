pragma solidity ^0.4.23;
import './Exchange.sol';

contract FallbackTrap {
    Exchange public exchange;
    bool public isArmed = false;

    function arm() public {
        isArmed = true;
    }

    function disarm() public {
        isArmed = false;
    }

    function init(Exchange _exchange) public {
        exchange = _exchange;
    }

    function buy(address baseToken, address tradeToken, address owner, uint amount, uint price) public payable returns (uint64) {
        require(msg.value == amount * price / 1000000000000000000);
        exchange.buy.value(msg.value)(baseToken, tradeToken, owner, amount, price);
    }

    function cancelOrder(uint64 id) public {
        exchange.cancelOrder(id);
    }

    function() public payable {
        require(!isArmed);
    }
}
