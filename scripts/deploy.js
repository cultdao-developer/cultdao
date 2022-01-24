const { ethers, upgrades } = require("hardhat");
const { BN } = require("@openzeppelin/test-helpers");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const RouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const Token = await ethers.getContractFactory("Cult");
  const governanceToken = await ethers.getContractFactory(
    "GovernorBravoDelegate"
  );
  const treasuryContract = await ethers.getContractFactory("Treasury");
  const timeLockContract = await ethers.getContractFactory("Timelock");

  const cultToken = await upgrades.deployProxy(Token, [
    deployer.address,
    "100000000000000000000000",
  ]);
  await cultToken.deployed();

  console.log("Cult Token ", cultToken.address);

  const treasury = await upgrades.deployProxy(treasuryContract, [
    cultToken.address,
    RouterAddress.address,
  ]);
  await treasury.deployed();
  console.log("Treasury Token ", treasury.address);

  const timelock = await upgrades.deployProxy(timeLockContract, [
    deployer.address,
    120,
  ]);
  await timelock.deployed();
  console.log("Timelock Token ", timelock.address);

  const governance = await upgrades.deployProxy(governanceToken, [
    timelock.address,
    cultToken.address,
    17280,
    1,
    "60000000000000000000000",
    treasury.address,
  ]);
  console.log("Governance Token ", governance.address);
}

main();
