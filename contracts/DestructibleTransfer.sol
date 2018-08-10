pragma solidity ^0.4.23;

contract DestructibleTransfer {
    constructor(address payee) public payable {
        selfdestruct(payee);
    }
}
