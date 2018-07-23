# ContractLand Exchange Contracts
Token exchange with orderbook and matching engine implemented as a smart contract written in Solidity.

## Supported features
* Trading pair between any ERC20 tokens and Ether
* Automated order matching
* Trading directly from user wallet (address) without upfront deposit

## Algorithmic complexity
The orderbook is built with a combination of maps and tree (Red and Black Tree) to optimized performance.

* Order search O(log n)
* Order insertion O(log n)
* Order removal O(log n)

## Install and Deploy
1. `npm install`
2. In seperate window, run `ganache-cli --allowUnlimitedContractSize --gasLimit 10000000` (install ganache-cli globally if not installed). This allows deployment of contract of unlimited size. The gas cost of deploying NewExchange costs around 7000000 units of gas.
3. run `truffle migrate --reset --network development`

## Run Tests
1. run `npm run test`

## Usage & Interfaces

- Create Sell Order

- Create Buy Order

- Cancel Order

- Get Orderbook

- Get Order
