# ContractLand Exchange Contracts
Token exchange with orderbook and matching engine implemented as a smart contract written in Solidity.

## Supported features
* Trading pair between any ERC20 tokens and Ether
* Automated order matching
* Trading directly from user wallet (address) without upfront deposit

## Algorithmic complexity
The orderbook is built with a combination of maps and tree (Heap Tree) to optimized performance.

* Order search O(log n)
* Order insertion O(log n)
* Order removal O(log n)

## Install and Deploy via Truffle
1. `npm install`
2. In separate window, run `ganache-cli --allowUnlimitedContractSize --gasLimit 100000000` (install ganache-cli globally if not installed). This allows deployment of contract of unlimited size. The gas cost of deploying NewExchange costs around 7000000 units of gas.
3. run `truffle migrate --reset --network development`

## Run Tests
1. run `npm run test`

## Deploy to remote network
1. Create `.env` file based on `.env.example` in `development` directory.
2. run `npm run build-deploy`.

## Usage & Interfaces

- Create Sell Order
  - function sell(address baseToken, address tradeToken, address orderOwner, uint amount, uint price)
- Create Buy Order
  - function buy(address baseToken, address tradeToken, address orderOwner, uint amount, uint price)

- Cancel Order
  - function cancelOrder(uint64 id)

- Get Orderbook
  - function getAsks(uint16 limit, address tradeToken, address baseToken)
  - function getBids(uint16 limit, address tradeToken, address baseToken)

- Get Order Detail
  - getOrder(uint64 id)

- Get Trade History

- Get User Trade History
  - function getUserTradeHistory(uint16 limit, uint64[] timeRange, address user, address tradeToken, address baseToken)

- Get User Open Orders
  - function getUserOrders(address user, address tradeToken, address baseToken)

- Get User Order history
  - function getUserOrderHistory(uint16 limit, uint64[] timeRange, address user, address tradeToken, address baseToken)
