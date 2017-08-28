var token = artifacts.require("./MonethaToken.sol");
var ico = artifacts.require("./Crowdsale.sol");

module.exports = function(deployer) {
  const start = 1504188000;               // GMT: Thursday, 31 August 2017 14:00
  const end = 1506780000;                 // GMT: Saturday, 30 September 2017 14:00
  const timeAfterSoftCap = 120 * 60 * 60; // 120 hours
  const owner = "0x376c9fde9555e9a491c4cd8597ca67bb1bbf397e";
  const startTime = 1506780000;             // GMT: Saturday, 30 September 2017 14:00

  deployer.deploy(token, owner, startTime).then(function(){
    return deployer.deploy(ico,
      token.address,
      owner,
      owner,
      start,
      end,
      timeAfterSoftCap
    )
  });

};
