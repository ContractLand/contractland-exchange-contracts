const deployExchange = require('./src/exchange');

async function main() {
  const exchange = await deployExchange();
  console.log("\n**************************************************")
  console.log("          Deployment has been completed.          ")
  console.log("**************************************************\n\n")
  console.log(`[ Exchange ] Proxy: ${exchange.exchangeProxy}`)
  console.log(`[ Exchange ] Implementation: ${exchange.exchangeImplementation}`)
}
main()
