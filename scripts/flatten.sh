#!/usr/bin/env bash

rm -rf ../flats
mkdir -p ../flats

../node_modules/.bin/truffle-flattener ../contracts/Exchange.sol > ../flats/Exchange_flat.sol
