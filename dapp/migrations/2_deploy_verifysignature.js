const sign = artifacts.require('VerifySignature');

module.exports = function(deployer){
    deployer.deploy(sign);
}