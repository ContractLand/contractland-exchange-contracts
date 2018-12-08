const deployExchange = require('./src/exchange');

async function main() {
  const exchange = await deployExchange();
  console.log("\n**************************************************")
  console.log("          Deployment has been completed.          ")
  console.log("**************************************************\n\n")
  console.log(`[ Library  ] AskHeap: ${exchange.askHeap}`)
  console.log(`[ Library  ] BidHeap: ${exchange.bidHeap}`)
  console.log(`[ Exchange ] Implementation: ${exchange.exchangeImplementation}`)
  console.log(`[ Exchange ] Proxy: ${exchange.exchangeProxy}`)
}
main()
