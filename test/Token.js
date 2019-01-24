let utils = require("./utils.js");

let token = artifacts.require("./MonethaToken.sol");
let instance;
let totalSupply = 40240000000000;
let start = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 1000;
let locked = 15291200000000;
let reserved = 20120000000000;

contract("token", accounts => {
  let owner = accounts[0];
  before(async () => {
    instance = await token.new(owner, start);
  });

  it("test initialization", async () => {
    let balance = await instance.balanceOf.call(accounts[0]);
    assert.equal(balance, totalSupply);
    let bal = await instance.balanceOf.call(accounts[1]);
    assert.equal(bal, 0);
    let allowance = await instance.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowance, 0);
    let startTime = await instance.startTime.call();
    assert.equal(startTime, start);
  });

  it("should fail to burn tokens because too early", async () => {
    let result = await instance.burn();
    assert.equal(result.logs.length, 0); //no Burn event
    let supply = await instance.totalSupply.call();
    assert.equal(supply, totalSupply);
  });

  it("should allow acc1 to spend 10MTH", async () => {
    let result = await instance.approve(accounts[1], 1000000);
    let event = result.logs[0].args;
    assert.equal(event._owner, accounts[0]);
    assert.equal(event.spender, accounts[1]);
    assert.equal(event.value, 1000000);
    let allowed = await instance.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowed, 1000000);
  });

  it("should fail to set allowance to 20MTH", async () => {
    try {
      let result = await instance.approve(accounts[1], 2000000);
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {}
  });

  it("should set allowance to 0MTH", async () => {
    await instance.approve(accounts[1], 0);
    let allowed = await instance.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowed, 0);
  });

  it("should set allowance to 20MTH", async () => {
    await instance.approve(accounts[1], 2000000);
    let allowed = await instance.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowed.toNumber(), 2000000);
  });

  it("should transfer 20MTH from the owner to acc1", async () => {
    let result = await instance.transferFrom(
      accounts[0],
      accounts[1],
      2000000,
      { from: accounts[1] }
    );
    let event = result.logs[0].args;
    assert(event.from, accounts[0]);
    assert(event.to, accounts[1]);
    assert(event.value, 2000000);
    let balance = await instance.balanceOf(accounts[1]);
    assert(balance, 2000000);
    let bal = await instance.balanceOf(accounts[0]);
    assert(bal, totalSupply - 2000000);
    let allowance = await instance.allowance(accounts[0], accounts[1]);
    assert(allowance, 0);
  });

  it("should fail to transfer more funds to acc1 because of missing allowance", async () => {
    try {
      let result = await instance.transferFrom(
        accounts[0],
        accounts[1],
        2000000,
        { from: accounts[1] }
      );
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {}
  });

  it("should fail to transfer from acc1, because trading not yet enabled", async () => {
    try {
      let result = await instance.transfer(accounts[2], 5000, {
        from: accounts[1]
      });
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {
      try {
        let result = await instance.transferFrom(
          accounts[1],
          accounts[2],
          5000,
          { from: accounts[1] }
        );
        throw new Error(
          "Promise was unexpectedly fulfilled. Result: " + result
        );
      } catch (err) {}
    }
  });

  it("should transfer from acc1 to acc2", async () => {
    utils.increaseTime(
      start - web3.eth.getBlock(web3.eth.blockNumber).timestamp + 10
    );
    let result = await instance.transfer(accounts[2], 1000000, {
      from: accounts[1]
    });
    var event = result.logs[0].args;
    assert(event.from, accounts[1]);
    assert(event.to, accounts[2]);
    assert(event.value, 1000000);
    let balance = await instance.balanceOf(accounts[2]);
    assert(balance, 1000000);
    let bal = await instance.balanceOf(accounts[1]);
    assert(bal, 1000000);
  });

  it("should fail to transfer from acc1 because of insufficient funds", async () => {
    try {
      let result = await instance.transfer(accounts[2], 6000000, {
        from: accounts[1]
      });
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {}
  });

  it("should burn all of the owner's tokens but the reserved amount", async () => {
    let result = await instance.burn();
    let event = result.logs[0].args;
    assert(event.amount.toNumber(), reserved);
    let bal = await instance.balanceOf.call(accounts[0]);
    assert(bal, reserved);
    let supply = await instance.totalSupply.call();
    assert.equal(supply.toNumber(), reserved + 2000000);
  });

  it("call burn a second time. should do nothing", async () => {
    let result = await instance.burn();
    assert.equal(result.logs.length, 0); //no Burn event
  });

  it("should spend a few bounty tokens", async () => {
    await instance.transfer(accounts[7], 5000000000);
    let bal = await instance.balanceOf.call(accounts[7]);
    assert(bal, 5000000000);
  });

  it("should fail to spend the locked tokens", async () => {
    try {
      let result = await instance.transfer(accounts[7], 5000000000000, {
        from: owner
      });
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {
      let bal = await instance.balanceOf.call(accounts[7]);
      assert(bal, 5000000000);
    }
  });

  it("should fail to change the start time", async () => {
    try {
      let result = await instance.setStart(10000);
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {
      let startTime = await instance.startTime();
      assert.equal(startTime, start);
    }
  });

  it("should set an ico address and change the start time", async () => {
    await instance.setICO(accounts[0]);
    await instance.setStart(1506770000);
    let startTime = await instance.startTime();
    assert.equal(startTime, 1506770000);
  });

  it("should fail to change the start time because new start time has to be before old start time", async () => {
    try {
      let result = await instance.setStart(1506880000);
      throw new Error("Promise was unexpectedly fulfilled. Result: " + result);
    } catch (error) {
      let startTime = await instance.startTime();
      assert.equal(startTime, 1506770000);
    }
  });
});