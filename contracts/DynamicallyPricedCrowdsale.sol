pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";

contract DynamicallyPricedCrowdsale is TimedCrowdsale {
  uint256[] public rateStartTimes;
  mapping (uint256 => uint256) public rateIndex;

  function DynamicallyPricedCrowdsale(uint256[] _rates, uint256[] _rateStartTimes) public {
    require(_rates.length >= 1 && _rates.length < 10);
    require(_rates.length == _rateStartTimes.length);
    require(_rates[0] > 0 && _rateStartTimes[0] >= now);

    rateIndex[0] = _rates[0];
    rateStartTimes.push(_rateStartTimes[0]);

    for (uint i = 1; i < _rates.length; i++) {
      require(_rates[i] > 0);
      require(_rateStartTimes[i] > _rateStartTimes[i - 1]);

      rateIndex[i] = _rates[i];
      rateStartTimes.push(_rateStartTimes[i]);
    }
  }

  function getCurrentRate() public view returns (uint256) {
    uint256 index = 0;

    for (uint i = 0; i < rateStartTimes.length; i++) {
      if(rateStartTimes[i] <= now) {
        index = i;
      }
    }
    return rateIndex[index];
  }

  function getRateStartTimes() public constant returns (uint256[]) {
    return rateStartTimes;
  }

  function getRateAtIndex(uint256 index) public constant returns (uint256) {
    return rateIndex[index];
  }

  function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
    uint256 currentRate = getCurrentRate();
    return currentRate.mul(_weiAmount);
  }
}
