const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider('http://localhost:9545');
const web3 = new Web3(provider);
const fs = require('fs');
const contract_dir = "../../build/contracts/";
const contract = require("truffle-contract");

function eventListenerSetup(crowdsaleInstance) {
    var LogEvent = crowdsaleInstance.Log({
        fromBlock: 0,
        toBlock: 'latest'
    });

    console.log("Waiting for crowdsale events");
    LogEvent.watch( (error, result) => {
        if(error) {
            console.log("error====: " + error);
        } else {
            console.log("result====: " + JSON.stringify(result));
        }
    });
}

async function main() {
    const SimpleCrowdsaleJson = JSON.parse(fs.readFileSync(contract_dir + "SimpleCrowdsale.json"));
    const SimpleCrowdsale = contract(SimpleCrowdsaleJson);
    SimpleCrowdsale.setProvider(provider);

    try {
        SimpleCrowdsale.defaults( {
            from: web3.eth.accounts[0],
            gasPrice: 0,
            gas: 4000000,
        });

        crowdsaleInstance = await SimpleCrowdsale.at("0x2c2b9c9a4a25e24b174f26114e8926a9f2128fe4");

        eventListenerSetup(crowdsaleInstance);
    } catch(e) {
        console.log(e);
    }
}

main();
