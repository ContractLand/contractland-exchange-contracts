pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "./DynamicallyPricedCrowdsale.sol";

/**
 * @title CrowdsaleTemplate
 * @dev This is a fully fledged crowdsale.
 * The way to add new features to a base crowdsale is by multiple inheritance.
 * In this example we are providing following extensions:
 * CappedCrowdsale - sets a max boundary for raised funds
 * RefundableCrowdsale - set a min goal to be reached and returns funds if it's not met
 *
 * After adding multiple features it's good practice to run integration tests
 * to ensure that subcontracts works together as intended.
 */
contract SimpleCrowdsale is CappedCrowdsale, RefundableCrowdsale, MintedCrowdsale, DynamicallyPricedCrowdsale {

  function SimpleCrowdsale(uint256[] _rates,
                           uint256[] _rateStartTimes,
                           uint256 _closingTime,
                           uint256 _goal,
                           uint256 _cap,
                           address _wallet,
                           MintableToken _token) public
    Crowdsale(_rates[0], _wallet, _token)
    CappedCrowdsale(_cap)
    RefundableCrowdsale(_goal)
    TimedCrowdsale(_rateStartTimes[0], _closingTime)
    DynamicallyPricedCrowdsale(_rates, _rateStartTimes)
  {
    //As goal needs to be met for a successful crowdsale
    //the value needs to less or equal than a cap which is limit for accepted funds
    require(_goal <= _cap);
  }
}
