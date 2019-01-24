#!/usr/bin/env bash

# Based on https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/scripts/test.sh

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache-cli instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_cli_pid" ] && ps -p $ganache_cli_pid > /dev/null; then
    kill -9 $ganache_cli_pid
  fi
}

ganache_cli_running() {
  nc -z localhost 8545
}

run_ganache_cli() {
  ganache-cli --defaultBalanceEther 20000000000000000000 > /dev/null &
}

if ganache_cli_running; then
  echo "Using existing ganache-cli instance"
else
  echo "Starting our own ganache-cli instance"
  run_ganache_cli
  ganache_cli_pid=$!
fi

node_modules/.bin/truffle test --network development"$@"
