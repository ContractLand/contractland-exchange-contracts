pragma solidity ^0.4.24;

import "../libraries/Arrays.sol";

contract TestArrays {
    using Arrays for uint64[];

    uint64[] private array;

    constructor (uint64[] _array) public {
        array = _array;
    }

    function findUpperBound(uint64 _element) external view returns (uint256) {
        return array.findUpperBound(_element);
    }
}
