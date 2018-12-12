pragma solidity ^0.4.24;

contract DestructibleTransfer {
    constructor(address payee) public payable {
        selfdestruct(payee);
    }
}
