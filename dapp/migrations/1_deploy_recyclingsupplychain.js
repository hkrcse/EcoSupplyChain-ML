const echochain = artifacts.require('RecyclingSupplyChain');

module.exports = function(deployer){
    deployer.deploy(echochain);
}