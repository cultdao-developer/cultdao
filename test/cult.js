const { parse } = require("@ethersproject/transactions");
const { contract, privateKeys } = require("@openzeppelin/test-environment");
const {
  BN,
  expectRevert,
  expectEvent,
  constants,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { signTypedData } = require("eth-sig-util");
const { time } = require("../utilities");

const {
  address,
  etherMantissa,
  encodeParameters,
  mineBlock,
} = require("../utilities/Ethereum");

let ownerAddress;
let userAddress1;
let userAddress2;
const GovernorBravoDelegate = artifacts.require("GovernorBravoDelegate");
const CULTToken = artifacts.require("Cult");
const decimal = new BN(18);
const oneether = new BN(10).pow(decimal);
const totalSupply = new BN(100000000000000).mul(oneether);

describe("ERC20 tokens", function () {
  beforeEach(async function () {
    accounts = await web3.eth.getAccounts();
    [ownerAddress, userAddress1, userAddress2] = accounts;
    this.cult = await CULTToken.new({ from: ownerAddress, gas: 8000000 });
    this.cult.initialize(ownerAddress, totalSupply, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.cult.setTreasuryAddress(ownerAddress, { from: ownerAddress });
  });
  describe("Transfer functionality ", function () {
    beforeEach(async function () {});

    it("Tranfer from Account 1 to Account 2", async function () {
      await this.cult.transfer(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      expect(await this.cult.balanceOf(ownerAddress)).to.be.bignumber.equal(
        new BN(99999999950000).mul(oneether)
      );
    });
    it("Account 1 balance should be increased", async function () {
      await this.cult.transfer(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      expect(await this.cult.balanceOf(userAddress1)).to.be.bignumber.equal(
        new BN(50000).mul(oneether)
      );
    });
    it("Tranfer from Account 1 to Account 2", async function () {
      await this.cult.transfer(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transfer(ownerAddress, new BN(50000).mul(oneether), {
        from: userAddress1,
      });
      expect(await this.cult.balanceOf(ownerAddress)).to.be.bignumber.equal(
        totalSupply
      );
    });
    it("Account 1 balance should be decreased", async function () {
      await this.cult.transfer(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transfer(ownerAddress, new BN(50000).mul(oneether), {
        from: userAddress1,
      });
      expect(await this.cult.balanceOf(userAddress1)).to.be.bignumber.equal(
        new BN(0)
      );
    });
  });
  describe("Transfer from", function () {
    beforeEach(async function () {});
    it("WithOut Approve", async function () {
      await expectRevert(
        this.cult.transferFrom(ownerAddress, userAddress1, 1000, {
          from: ownerAddress,
        }),
        "ERC20: transfer amount exceeds allowance"
      );
    });
    it("Tranfer from Account 1 to Account 2", async function () {
      await this.cult.approve(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transferFrom(
        ownerAddress,
        userAddress1,
        new BN(50000).mul(oneether),
        { from: userAddress1 }
      );
      expect(await this.cult.balanceOf(ownerAddress)).to.be.bignumber.equal(
        new BN(99999999950000).mul(oneether)
      );
    });
    it("Account 1 balance should be increased", async function () {
      await this.cult.approve(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transferFrom(
        ownerAddress,
        userAddress1,
        new BN(50000).mul(oneether),
        { from: userAddress1 }
      );
      expect(await this.cult.balanceOf(userAddress1)).to.be.bignumber.equal(
        new BN(50000).mul(oneether)
      );
    });
    it("Tranfer from Account 1 to Account 2", async function () {
      await this.cult.approve(ownerAddress, new BN(50000).mul(oneether), {
        from: userAddress1,
      });
      await this.cult.approve(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transferFrom(
        ownerAddress,
        userAddress1,
        new BN(50000).mul(oneether),
        { from: userAddress1 }
      );
      await this.cult.transferFrom(
        userAddress1,
        ownerAddress,
        new BN(50000).mul(oneether),
        { from: ownerAddress }
      );
      expect(await this.cult.balanceOf(ownerAddress)).to.be.bignumber.equal(
        totalSupply
      );
    });
    it("Account 1 balance should be decreased", async function () {
      await this.cult.approve(ownerAddress, new BN(50000).mul(oneether), {
        from: userAddress1,
      });
      await this.cult.approve(userAddress1, new BN(50000).mul(oneether), {
        from: ownerAddress,
      });
      await this.cult.transferFrom(
        ownerAddress,
        userAddress1,
        new BN(50000).mul(oneether),
        { from: userAddress1 }
      );
      await this.cult.transferFrom(
        userAddress1,
        ownerAddress,
        new BN(50000).mul(oneether),
        { from: ownerAddress }
      );
      expect(await this.cult.balanceOf(userAddress1)).to.be.bignumber.equal(
        new BN(0)
      );
    });
  });

  describe("Approve/Allowance", function () {
    beforeEach(async function () {});
    it("Initial allowance will be 0", async function () {
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(0));
    });

    it("Allowance increase when approve", async function () {
      await this.cult.approve(userAddress2, 500, { from: ownerAddress });
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(500));
    });

    it("Increase Allowance", async function () {
      await this.cult.increaseAllowance(userAddress2, 500, {
        from: ownerAddress,
      });
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(500));
    });

    it("Decrease Allowance", async function () {
      await this.cult.approve(userAddress2, 500, { from: ownerAddress });
      await this.cult.decreaseAllowance(userAddress2, 500, {
        from: ownerAddress,
      });
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(0));
    });

    it("Allowance will be 0 of tx account", async function () {
      await this.cult.approve(userAddress2, 500, { from: ownerAddress });
      expect(
        await this.cult.allowance(userAddress2, ownerAddress)
      ).to.be.bignumber.equal(new BN(0));
    });

    it("TranferFrom failed without allowance", async function () {
      await expectRevert(
        this.cult.transferFrom(ownerAddress, userAddress1, 100000000000, {
          from: ownerAddress,
        }),
        "ERC20: transfer amount exceeds allowance"
      );
    });

    it("TranferFrom with allowance", async function () {
      await this.cult.approve(userAddress2, 500, { from: ownerAddress });
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(500));

      await this.cult.transferFrom(ownerAddress, userAddress2, 500, {
        from: userAddress2,
      });
      expect(
        await this.cult.allowance(ownerAddress, userAddress2)
      ).to.be.bignumber.equal(new BN(0));

      expect(await this.cult.balanceOf(userAddress2)).to.be.bignumber.equal(
        new BN(500)
      );
    });
  });
});
