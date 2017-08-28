let utils = require('./utils.js')

let ico = artifacts.require("./Crowdsale.sol");
let token = artifacts.require("./MonethaToken.sol");
let fundingGoal = 672000000000;
let softCap = 6720000000000;
let maxGoal = 20120000000000;
let start = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 1000;
let end = start + 30 * (60 * 60 * 24); // 30 days
let tokenStartTime = end;
let timeAfterSoftCap = 120 * 60 * 60; // 120 hours
let reserved = 20120000000000;
let owner = "0x376c9fde9555e9a491c4cd8597ca67bb1bbf397e";
let tokenInstance, icoInstance;

contract('ICO', accounts => {

  before(async() => {
    tokenInstance = await token.new(owner, tokenStartTime);
    icoInstance = await ico.new(
      tokenInstance.address,
      owner,
      owner,
      start,
      end,
      timeAfterSoftCap
    );
  });

  it("test initialization", async() => {
    let goal = await icoInstance.fundingGoal.call();
    assert.equal(goal.toNumber(), fundingGoal, "wrong funding goal");
    let cap = await icoInstance.softCap.call();
    assert.equal(cap.toNumber(), softCap, "wrong soft cap");
    let mGoal = await icoInstance.maxGoal.call();
    assert.equal(mGoal.toNumber(), maxGoal, "wrong max goal");
    let icoStartTime = await icoInstance.start.call();
    assert.equal(icoStartTime.toNumber(), start, "wrong start date");
    let icoEndTime = await icoInstance.end.call();
    assert.equal(icoEndTime.toNumber(), end, "wrong end date");
  });

  it("test token calculation: should return the correct amount of tokens (2400 MTH per Eth) and false", async() => {
    let result = await icoInstance.getNumTokens.call(web3.toWei(100, "ether"));
    assert.equal(result[0].toNumber(), 100 * 240000000);
    assert(!result[1]);
  });

  it("test token calculation: should return the correct amount of tokens, exactly the softcap (2400 MTH per Eth) and true.", async() => {
    let result = await icoInstance.getNumTokens.call(web3.toWei(28000, "ether"));
    assert.equal(result[0].toNumber(), softCap);
    assert(result[1]);
  });

  it("test token calculation: should return the correct amount of tokens (2400 MTH per Eth until softcap, 2000 MTH for the rest) and true.", async() => {
    let result = await icoInstance.getNumTokens.call(web3.toWei(40000, "ether"));
    assert.equal(result[0].toNumber(), softCap + 12000 * 200000000);
    assert(result[1]);
  });

  it("should fail to set the ICO contract from a non-owner wallet", async() => {
    let result;
    try {
      result = await tokenInstance.setICO(accounts[3], {from: accounts[3]});
      throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
    } catch (error) {
      let icoAddress = await tokenInstance.ico();
      assert.equal(icoAddress, "0x0000000000000000000000000000000000000000");
    }
  });

  it("should set the ICO contract on the token contract and approve it to move the owner's funds", async() => {
    let result = await tokenInstance.setICO(icoInstance.address);
    let event = result.logs[0].args;
    assert.equal(event.value.toNumber(), maxGoal);
    let icoAddress = await tokenInstance.ico();
    assert.equal(icoAddress, icoInstance.address);
  });

  it("should fail to buy tokens, because too early", async() => {
    let result;
    try {
      result = await icoInstance.invest(accounts[2], {value: web3.toWei(30000, "ether")});
      throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
    } catch (error) {
      let balance = await tokenInstance.balanceOf.call(accounts[2]);
      assert.equal(balance.toNumber(), 0);
    }
  });

  it("should buy half of soft cap. end date should stay the same.", async() => {
    utils.increaseTime(start - web3.eth.getBlock(web3.eth.blockNumber).timestamp + 1)
    let result = await icoInstance.invest(accounts[2], {value: web3.toWei(14000, "ether")});
    let event = result.logs[0].args;
    assert.equal(event.amount.toNumber(), web3.toWei(14000, "ether"));
    let bal = await tokenInstance.balanceOf.call(accounts[2]);
    assert.equal(bal.toNumber(), softCap / 2);
    let icoEndTime = await icoInstance.end();
    assert.equal(icoEndTime.toNumber(), end);
  });

  it("should exceed softCap. should set end date to now + 120 hours", async() => {
    let expectedEndTime = start + 120 * 3600;
    let result = await icoInstance.invest(accounts[1], {value: web3.toWei(28000, "ether")});
    let event = result.logs[0].args;
    assert.equal(event.amount.toNumber(), web3.toWei(28000, "ether"));
    let bal = await tokenInstance.balanceOf.call(accounts[1]);
    assert.equal(bal.toNumber(), 14000 * 240000000 + 14000 * 200000000);
    let icoEndTime = await icoInstance.end();
    assert.equal(( icoEndTime.toNumber() - expectedEndTime ) < 5, true)
  });

  it("should buy 20000MTH from same account", async() => {
    let result = await icoInstance.invest(accounts[1], {value: web3.toWei(10, "ether")});
    let event = result.logs[0].args;
    assert.equal(event.amount.toNumber(), web3.toWei(10, "ether"));
    let bal = await tokenInstance.balanceOf.call(accounts[1]);
    assert.equal(bal.toNumber(), 14000 * 240000000 + 14000 * 200000000 + 2000000000);
  });

  it("should fail to buy tokens because of the max goal", async() => {
    let investorBalance = await tokenInstance.balanceOf.call(accounts[2]);
    try {
      let result = await icoInstance.invest(accounts[2], {value: web3.toWei(300000, "ether")});
      throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
    } catch (error) {
      let bal = await tokenInstance.balanceOf.call(accounts[2]);
      assert.equal(bal.toNumber(), investorBalance.toNumber());
    }
  });

  it("should fail to buy tokens with too low msg.value", async() => {
    try {
      let result = await icoInstance.invest(accounts[7], {value: 3});
      throw new Error('Promise was unexpectedly fulfilled. Result: ' + result);
    } catch (error) {
      let bal = await tokenInstance.balanceOf.call(accounts[7]);
      assert.equal(bal.toNumber(), 0);
    }
  });

  it("should fail to close crowdsale because too early", async() => {
    await icoInstance.checkGoalReached();
    let reached = await icoInstance.crowdsaleClosed.call();
    assert.equal(reached, false);
  });

  it("should close the crowdsale. goal should be reached. Should burn unsold tokens.", async() => {
    let startTime = await tokenInstance.startTime();
    utils.increaseTime(startTime.toNumber() - web3.eth.getBlock(web3.eth.blockNumber).timestamp + 1)
    let result = await icoInstance.checkGoalReached();
    let event = result.logs[0].args;
    assert.equal(event._beneficiary, accounts[0]);
    assert.equal(event._amountRaised.toNumber(), web3.toWei(42010, "ether"));
    let closed = await icoInstance.crowdsaleClosed.call();
    assert.equal(closed, true);
    let supply = await tokenInstance.totalSupply.call();
    assert.equal(supply.toNumber(), 29642000000000);
    let bal = await tokenInstance.balanceOf(accounts[0]);
    assert.equal(bal.toNumber(), reserved);
  });

  it("should fund the crowdsale contract from the owner's wallet", async() => {
    await icoInstance.sendTransaction({value: web3.toWei(30000, "ether")});
    assert.equal(web3.eth.getBalance(icoInstance.address).toNumber(), web3.toWei(30000, "ether"));
  });

  it("should withdraw the invested amount", async() => {
    let result = await icoInstance.safeWithdrawal({from: accounts[1]});
    let event = result.logs[0].args;
    assert.equal(event.backer, accounts[1]);
    assert.equal(event.amount.toNumber(), web3.toWei(28010, "ether"));
    assert.equal(event.isContribution, false);
    assert.equal(web3.eth.getBalance(icoInstance.address).toNumber(), web3.toWei(30000 - 28010, "ether"));
    let bal = await icoInstance.balanceOf.call(accounts[1]);
    assert.equal(bal.toNumber(), 0);
  });

});

