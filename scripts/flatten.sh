#!/usr/bin/env bash

rm -rf ../flats
mkdir -p ../flats

../node_modules/.bin/truffle-flattener ../contracts/NewExchange.sol > ../flats/NewExchange_flat.sol
