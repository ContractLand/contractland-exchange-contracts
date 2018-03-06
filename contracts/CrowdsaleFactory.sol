pragma solidity ^0.4.18;

import "./CrowdsaleToken.sol";
import "./SimpleCrowdsale.sol";
import "zeppelin-solidity/contracts/payment/PullPayment.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract CrowdsaleFactory is Ownable, PullPayment {
    uint256 public cost = 1 * 10 ** 18;
    mapping (address => address[]) public creatorToCrowdsaleMap;
    address[] created;

    function createCrowdsale(string _tokenName,
                             string _tokenSymbol,
                             uint256[] _rates,
                             uint256[] _rateStartTimes,
                             uint256 _closingTime,
                             uint256 _goal,
                             uint256 _cap,
                             address _wallet) payable public returns (address) {

        require(msg.value >= cost);
        asyncSend(owner, msg.value);

        CrowdsaleToken token = (new CrowdsaleToken(_tokenName, _tokenSymbol));
        SimpleCrowdsale crowdsale = (new SimpleCrowdsale(_rates, _rateStartTimes, _closingTime, _goal, _cap, _wallet, token));
        token.transferOwnership(address(crowdsale));

        creatorToCrowdsaleMap[msg.sender].push(address(crowdsale));
        created.push(address(crowdsale));
        return address(crowdsale);
    }

    function getCreatedCount() public constant returns(uint) {
        return created.length;
    }

    function getCrowdsaleAtIndex(uint256 index) public constant returns(address) {
        return created[index];
    }

    function setCost(uint256 newCost) onlyOwner public {
        cost = newCost;
    }
}
