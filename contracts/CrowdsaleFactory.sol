pragma solidity ^0.4.18;

import "./CrowdsaleToken.sol";
import "./SimpleCrowdsale.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract CrowdsaleFactory is Ownable {
    mapping (address => address[]) public creatorToCrowdsaleMap;
    address[] created;

    function createCrowdsale(string _tokenName,
                             string _tokenSymbol,
                             uint256 _openingTime,
                             uint256 _closingTime,
                             uint256 _rate,
                             uint256 _goal,
                             uint256 _cap,
                             address _wallet) public returns (address) {

        CrowdsaleToken token = (new CrowdsaleToken(_tokenName, _tokenSymbol));
        SimpleCrowdsale crowdsale = (new SimpleCrowdsale(_openingTime, _closingTime, _rate, _goal, _cap, _wallet, token));

        creatorToCrowdsaleMap[msg.sender].push(address(crowdsale));
        created.push(address(crowdsale));
        return address(crowdsale);
    }

    function getCreatedCount() public constant returns(uint) {
        return created.length;
    }

    function getCrowdsaleAtIndex(uint index) public constant returns(address) {
        return created[index];
    }

}
