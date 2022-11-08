const { ethers, upgrades } = require("hardhat");
const { BN } = require("@openzeppelin/test-helpers");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);
  const dCultAddress = "0x2d77B594B9BBaED03221F7c63Af8C4307432daF1";
  const governanceAddress = "0x0831172B9b136813b0B35e7cc898B1398bB4d7e7";

  const batchContract = await ethers.getContractFactory("BatchVote");

  const batch = await upgrades.deployProxy(batchContract, [
    governanceAddress,
    dCultAddress,
  ]);
  console.log("Batch vote contract", batch.address);
}

main();
