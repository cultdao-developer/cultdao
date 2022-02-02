const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { time } = require("../utilities");

describe("dcult contract", function () {
  let Token;
  let stakeToken;
  let cultToken;
  let dCultToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("Cult");
    stakeToken = await ethers.getContractFactory("Dcult");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const startBlock = await time.latestBlock();

    cultToken = await upgrades.deployProxy(Token, [owner.address, 100000]);
    await cultToken.deployed();
    await cultToken.setTreasuryAddress(owner.address);
    await cultToken.setWhitelistAddress(addr1.address, true);
    await cultToken.setWhitelistAddress(addr2.address, true);
    await cultToken.setWhitelistAddress(addrs[0].address, true);
    await cultToken.setTax(0);
    dCultToken = await upgrades.deployProxy(stakeToken, [
      cultToken.address,
      owner.address,
      startBlock,
      2,
    ]);
    await dCultToken.deployed();
  });
  describe("Deployment", function () {
    it("Should set the right owner CULT token", async function () {
      expect(await cultToken.owner()).to.equal(owner.address);
    });
    it("Should set the right owner of dCult", async function () {
      expect(await dCultToken.owner()).to.equal(owner.address);
    });
  });
  describe("Add Cult pool", function () {
    it("Should revert if non owner tries to add pool", async function () {
      await expect(
        dCultToken.connect(addr1).add(100, cultToken.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should set the right owner of dCult", async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      expect(await dCultToken.poolLength()).to.equal(1);
    });
  });

  describe("Delegate votes", function () {
    beforeEach(async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      await cultToken.connect(owner).transfer(addr1.address, 1000);
      await cultToken.connect(owner).transfer(addr2.address, 1000);
      await cultToken.connect(owner).approve(dCultToken.address, 1000);
      await cultToken.connect(addr1).approve(dCultToken.address, 1000);
      await cultToken.connect(addr2).approve(dCultToken.address, 1000);
      await dCultToken.connect(owner).deposit(0, 800);
      await dCultToken.connect(addr1).deposit(0, 900);
      await dCultToken.connect(addr2).deposit(0, 1000);
    });
    it("User should have zero votes initially", async function () {
      expect(await dCultToken.getVotes(owner.address)).to.equal(0);
    });
    it("User should have votes after delegate", async function () {
      await dCultToken.connect(owner).delegate(owner.address);
      expect(await dCultToken.getVotes(owner.address)).to.equal(800);
    });
    it("User can delegate votes to other users ", async function () {
      await dCultToken.connect(owner).delegate(addr1.address);
      expect(await dCultToken.getVotes(addr1.address)).to.equal(800);
    });
    it("Delegated user cannot delegate votes to other users ", async function () {
      await dCultToken.connect(owner).delegate(addrs[0].address);
      await dCultToken.connect(addrs[0]).delegate(addr2.address);
      expect(await dCultToken.getVotes(addr2.address)).to.equal(0);
    });
    it("User votes will reduce on withdraw ", async function () {
      await dCultToken.connect(owner).delegate(addr1.address);
      await dCultToken.connect(owner).withdraw(0, 100);
      expect(await dCultToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Delegated user votes will reduce on withdraw ", async function () {
      await dCultToken.connect(owner).delegate(addr1.address);
      await dCultToken.connect(owner).withdraw(0, 100);
      expect(await dCultToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Should revert if top staker tries to delegate", async function () {
      await expect(
        dCultToken.connect(addr1).delegate(addr1.address)
      ).to.be.revertedWith("Top staker cannot delegate");
    });
  });

  describe("Check dCult ERC20 token", function () {
    beforeEach(async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      await cultToken.connect(owner).transfer(addr1.address, 1000);
      await cultToken.connect(addr1).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr1).deposit(0, 1000);
      await cultToken.connect(owner).transfer(dCultToken.address, 1000);
    });
    it("User should have should have dcult token", async function () {
      expect(await dCultToken.balanceOf(addr1.address)).to.equal(1000);
    });

    it("User should have should have total token supply", async function () {
      const balance = await dCultToken.balanceOf(addr1.address);
      expect(await dCultToken.totalSupply()).to.equal(balance);
    });

    it("User should have should have dcult token after ", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 1000);
      await cultToken.connect(addr2).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr2).deposit(0, 1000);
      expect(await dCultToken.balanceOf(addr2.address)).to.equal(1000);
    });
    it("dcULT token should be burned on withdraw", async function () {
      await dCultToken.connect(addr1).withdraw(0, 100);
      expect(await dCultToken.balanceOf(addr1.address)).to.equal(900);
      expect(await dCultToken.totalSupply()).to.equal(900);

      await dCultToken.connect(addr1).withdraw(0, 900);
      expect(await dCultToken.balanceOf(addr1.address)).to.equal(0);
      expect(await dCultToken.totalSupply()).to.equal(0);
    });
    it("Token should be non transferable", async function () {
      await expect(
        dCultToken.connect(addr1).transfer(addr2.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        dCultToken.connect(addr1).transfer(dCultToken.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        dCultToken
          .connect(addr1)
          .transfer("0x0000000000000000000000000000000000000000", 900)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });
  describe("Check top stakers", function () {
    beforeEach(async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      await cultToken.connect(owner).transfer(addr1.address, 1000);
      await cultToken.connect(addr1).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr1).deposit(0, 1000);
    });
    it("First User should have should be highest staker", async function () {
      expect(await dCultToken.checkHighestStaker(0, addr1.address)).to.equal(
        true
      );
    });

    it("All user under the limit should be top staker", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 2000);
      await cultToken.connect(addr2).approve(dCultToken.address, 2000);
      await dCultToken.connect(addr2).deposit(0, 2000);

      expect(await dCultToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
    });

    it("User with more amount should remove the user with less staked amount", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 2000);
      await cultToken.connect(addr2).approve(dCultToken.address, 2000);
      await dCultToken.connect(addr2).deposit(0, 2000);

      await cultToken.connect(owner).transfer(addrs[0].address, 2000);
      await cultToken.connect(addrs[0]).approve(dCultToken.address, 2000);
      await dCultToken.connect(addrs[0]).deposit(0, 2000);

      expect(await dCultToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await dCultToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
      expect(await dCultToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });

    it("User shoul be removed from top staker list on withdrawal", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 2000);
      await cultToken.connect(addr2).approve(dCultToken.address, 2000);
      await dCultToken.connect(addr2).deposit(0, 2000);

      await cultToken.connect(owner).transfer(addrs[0].address, 2000);
      await cultToken.connect(addrs[0]).approve(dCultToken.address, 2000);
      await dCultToken.connect(addrs[0]).deposit(0, 2000);

      await dCultToken.connect(addr2).withdraw(0, 2000);

      expect(await dCultToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await dCultToken.checkHighestStaker(0, addr2.address)).to.equal(
        false
      );
      expect(await dCultToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });
  });
  describe("Check Cult distribution with one user", function () {
    beforeEach(async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      await cultToken.connect(owner).transfer(addr1.address, 1000);
      await cultToken.connect(addr1).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr1).deposit(0, 1000);
      await cultToken.connect(owner).transfer(dCultToken.address, 1000);
    });
    it("User pending should be correct", async function () {
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(1000);
    });
    it("User can claim token", async function () {
      const beforeClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dCultToken.connect(addr1).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });

    it("Second cannot claim for deposit/stake after reward send to contract", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 1000);
      await cultToken.connect(addr2).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await dCultToken.connect(addr2).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(0);
    });

    it("User rewards will be claimed during deposit", async function () {
      await cultToken.connect(owner).transfer(addr1.address, 10);
      await cultToken.connect(addr1).approve(dCultToken.address, 10);
      await time.advanceBlock();
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(1000);
      const beforeClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(10);
      await dCultToken.connect(addr1).deposit(0, 10);
      const afterClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });
  });

  describe("Check Cult distribution with multiple address user", function () {
    beforeEach(async function () {
      await dCultToken.connect(owner).add(100, cultToken.address, true);
      await cultToken.connect(owner).transfer(addr1.address, 1000);
      await cultToken.connect(addr1).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr1).deposit(0, 1000);
      await cultToken.connect(owner).transfer(addr2.address, 1000);
      await cultToken.connect(addr2).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr2).deposit(0, 1000);
      await cultToken.connect(owner).transfer(dCultToken.address, 1000);
    });
    it("User first pending should be correct", async function () {
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(500);
    });
    it("User second pending should be correct", async function () {
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(500);
    });
    it("User first should claim half Reward", async function () {
      const beforeClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dCultToken.connect(addr1).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(500);
    });
    it("User second should claim half Reward", async function () {
      const beforeClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dCultToken.connect(addr2).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim extra rewards for deposit/stake after reward send to contract", async function () {
      await cultToken.connect(owner).transfer(addr2.address, 1000);
      await cultToken.connect(addr2).approve(dCultToken.address, 1000);
      await dCultToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await cultToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await dCultToken.connect(addr1).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim after withdrawal", async function () {
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(500);
      const beforeClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await dCultToken.connect(addr2).withdraw(0, 1000);
      const afterClaimBalance = await cultToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(1500);
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(0);
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(500);
      await cultToken.connect(owner).transfer(dCultToken.address, 1000);
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(0);
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(1500);
      await dCultToken.connect(addr1).claimCULT(0);
      expect(await cultToken.balanceOf(addr1.address)).to.equal(1500);
      await dCultToken.connect(addr2).claimCULT(0);
      expect(await cultToken.balanceOf(addr2.address)).to.equal(1500);
    });

    it("Third user can only claim rewards after deposit", async function () {
      await cultToken.connect(owner).transfer(addrs[0].address, 2000);
      await cultToken.connect(addrs[0]).approve(dCultToken.address, 2000);
      await time.advanceBlock();
      // Third user reward will always 0 before
      expect(await dCultToken.pendingCULT(0, addrs[0].address)).to.equal(0);

      await dCultToken.connect(addrs[0]).deposit(0, 2000);
      expect(await dCultToken.pendingCULT(0, addrs[0].address)).to.equal(0);
      await cultToken.connect(owner).transfer(dCultToken.address, 2000);
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(1000);
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(1000);
      expect(await dCultToken.pendingCULT(0, addrs[0].address)).to.equal(1000);

      const beforeClaimBalance = await cultToken.balanceOf(addrs[0].address);
      expect(beforeClaimBalance).to.equal(0);
      await dCultToken.connect(addrs[0]).claimCULT(0);
      const afterClaimBalance = await cultToken.balanceOf(addrs[0].address);
      expect(afterClaimBalance).to.equal(1000);

      await dCultToken.connect(addrs[0]).withdraw(0, 1000);
      await cultToken.connect(owner).transfer(dCultToken.address, 3000);
      expect(await dCultToken.pendingCULT(0, addr1.address)).to.equal(2000);
      expect(await dCultToken.pendingCULT(0, addr2.address)).to.equal(2000);
      expect(await dCultToken.pendingCULT(0, addrs[0].address)).to.equal(1000);
    });
  });
});
