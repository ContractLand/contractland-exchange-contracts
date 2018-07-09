# Install and Deploy
1. `npm install`
2. In seperate window, run `ganache-cli --allowUnlimitedContractSize --gasLimit 10000000` (install ganache-cli globally if not installed). This allows deployment of contract of unlimited size. The gas cost of deploying NewExchange costs around 7000000 units of gas.
3. run `truffle migrate --reset --network development`

# Run Tests
1. run `npm run test`
