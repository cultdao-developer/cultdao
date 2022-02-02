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
const Timelock = artifacts.require("Timelock");
const dCultToken = artifacts.require("Dcult");

describe("GovernorBravo_Propose", function () {
  let trivialProposal, targets, values, signatures, callDatas, delay;
  let proposalBlock;
  //   const [ ownerAddress, userAddress1, userAddress2] = accounts;
  beforeEach(async function () {
    const startBlock = await time.latestBlock();
    accounts = await web3.eth.getAccounts();
    [ownerAddress, userAddress1, userAddress2] = accounts;
    delay = new BN(2 * 24 * 60 * 60 * 2);

    this.CULT = await CULTToken.new({ from: ownerAddress, gas: 8000000 });
    this.CULT.initialize(ownerAddress, "6666666666666666666666666666666", {
      from: ownerAddress,
      gas: 8000000,
    });
    this.timelock = await Timelock.new(ownerAddress, delay, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.dCultToken = await dCultToken.new({
      from: ownerAddress,
      gas: 8000000,
    });
    await this.dCultToken.initialize(
      this.CULT.address,
      ownerAddress,
      startBlock,
      1,
      {
        from: ownerAddress,
        gas: 8000000,
      }
    );
    await this.CULT.setWhitelistAddress(ownerAddress, true, {
      from: ownerAddress,
    });
    await this.CULT.setWhitelistAddress(userAddress1, true, {
      from: ownerAddress,
    });
    await this.CULT.setWhitelistAddress(userAddress2, true, {
      from: ownerAddress,
    });
    await this.dCultToken.add(100, this.CULT.address, true, {
      from: ownerAddress,
      gas: 8000000,
    });

    await this.CULT.approve(this.dCultToken.address, 10000, {
      from: ownerAddress,
      gas: 8000000,
    });
    await this.CULT.transfer(userAddress1, 10000, {
      from: ownerAddress,
      gas: 8000000,
    });
    await this.CULT.approve(this.dCultToken.address, 10000, {
      from: userAddress1,
      gas: 8000000,
    });
    await this.dCultToken.deposit(0, 1000, {
      from: ownerAddress,
      gas: 8000000,
    });
    await this.dCultToken.deposit(0, 900, {
      from: userAddress1,
      gas: 8000000,
    });
    await this.dCultToken.delegate(userAddress1, {
      from: userAddress1,
      gas: 8000000,
    });
    await this.timelock.initialize(ownerAddress, delay, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.gov = await GovernorBravoDelegate.new(
      this.timelock.address,
      this.CULT.address,
      ownerAddress,
      { from: ownerAddress, gas: 8000000 }
    );
    await this.gov.initialize(
      this.timelock.address,
      this.dCultToken.address,
      17280,
      1,
      "60000000000000000000000",
      userAddress2,
      { from: ownerAddress, gas: 8000000 }
    );
    // await this.CULT.mint(ownerAddress, "1000000000000000000000000", {from: ownerAddress, gas: 8000000})
    await this.timelock.setPendingAdmin(this.gov.address, {
      from: ownerAddress,
      gas: 8000000,
    });
    await this.gov._AcceptTimelockAdmin({ from: ownerAddress, gas: 8000000 });
    await this.CULT.delegate(userAddress1, { from: ownerAddress });

    targets = [ownerAddress];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(["address"], [userAddress1])];
    await this.gov.propose(
      targets,
      values,
      signatures,
      callDatas,
      "do nothing",
      { from: ownerAddress, gas: 8000000 }
    );
    proposalBlock = await time.latestBlock();
    proposalId = await this.gov.latestProposalIds(ownerAddress);
    trivialProposal = await this.gov.proposals(proposalId);
  });

  describe("Non top staker tries to create proposal", function () {
    it("", async function () {
      await expectRevert(
        this.gov.propose(
          targets.concat(ownerAddress),
          values,
          signatures,
          callDatas,
          "do nothing",
          { from: userAddress1, gas: 8000000 }
        ),
        "GovernorBravo::propose: only top staker"
      );
    });
  });

  describe("simple initialization", function () {
    it("ID is set to a globally unique identifier", async function () {
      expect(trivialProposal.id).to.be.bignumber.equal(new BN(proposalId));
    });

    it("Proposer is set to the sender", async function () {
      expect(trivialProposal.proposer).to.equal(ownerAddress);
    });

    it("ForVotes and AgainstVotes are initialized to zero", async function () {
      expect(trivialProposal.forVotes).to.be.bignumber.equal(new BN(0));
      expect(trivialProposal.againstVotes).to.be.bignumber.equal(new BN(0));
    });

    it("Executed and Canceled flags are initialized to false", async function () {
      expect(trivialProposal.canceled).to.equal(false);
      expect(trivialProposal.executed).to.equal(false);
    });

    it("ETA is initialized to zero", async function () {
      expect(trivialProposal.eta).to.be.bignumber.equal(new BN(0));
    });

    it("Targets, Values, Signatures, Calldatas are set according to parameters", async function () {
      const dynamicFields = await this.gov.getActions(trivialProposal.id);

      expect(dynamicFields[0][0]).to.equal(targets[0]);
      expect(dynamicFields[1][0]).to.be.bignumber.equal(new BN(values[0]));
      expect(dynamicFields[2][0]).to.equal(signatures[0]);
      expect(dynamicFields[3][0]).to.equal(callDatas[0]);
    });

    describe("This function must revert if", function () {
      it("the length of the values, signatures or calldatas arrays are not the same length,", async function () {
        await expectRevert(
          this.gov.propose(
            targets.concat(ownerAddress),
            values,
            signatures,
            callDatas,
            "do nothing",
            { from: ownerAddress, gas: 8000000 }
          ),
          "GovernorBravo::propose: proposal function information arity mismatch"
        );

        await expectRevert(
          this.gov.propose(
            targets.concat(ownerAddress),
            values,
            signatures,
            callDatas,
            "do nothing",
            { from: userAddress1, gas: 8000000 }
          ),
          "GovernorBravo::propose: only top staker"
        );

        await expectRevert(
          this.gov.propose(
            targets,
            values.concat(values),
            signatures,
            callDatas,
            "do nothing",
            { from: ownerAddress, gas: 8000000 }
          ),
          "GovernorBravo::propose: proposal function information arity mismatch"
        );

        await expectRevert(
          this.gov.propose(
            targets,
            values,
            signatures.concat(signatures),
            callDatas,
            "do nothing",
            { from: ownerAddress, gas: 8000000 }
          ),
          "GovernorBravo::propose: proposal function information arity mismatch"
        );

        await expectRevert(
          this.gov.propose(
            targets,
            values,
            signatures,
            callDatas.concat(callDatas),
            "do nothing",
            { from: ownerAddress, gas: 8000000 }
          ),
          "GovernorBravo::propose: proposal function information arity mismatch"
        );
      });

      it("or if that length is zero or greater than Max Operations.", async function () {
        await expectRevert(
          this.gov.propose([], [], [], [], "do nothing", {
            from: ownerAddress,
            gas: 8000000,
          }),
          "GovernorBravo::propose: must provide actions"
        );
      });

      describe("Additionally, if there exists a pending or active proposal from the same proposer, we must revert.", function () {
        it("reverts with pending", async function () {
          await expectRevert(
            this.gov.propose(
              targets,
              values,
              signatures,
              callDatas,
              "do nothing",
              { from: ownerAddress, gas: 8000000 }
            ),
            "GovernorBravo::propose: one live proposal per proposer, found an already pending proposal"
          );
        });
      });
    });
  });

  describe("GovernorBravo#state/1", function () {
    it("Invalid for proposal not found", async function () {
      await expectRevert(
        this.gov.state(5),
        "GovernorBravo::state: invalid proposal id"
      );
    });

    it("Pending", async function () {
      expect(await this.gov.state(trivialProposal.id)).to.be.bignumber.equal(
        new BN(0)
      );
    });

    it("Active", async function () {
      await time.advanceBlock();
      await time.advanceBlock();
      expect(await this.gov.state(trivialProposal.id)).to.be.bignumber.equal(
        new BN(1)
      );
    });

    it("Canceled", async function () {
      await time.advanceBlock();
      await this.gov.cancel(trivialProposal.id, {
        from: ownerAddress,
        gas: 8000000,
      });
      expect(await this.gov.state(trivialProposal.id)).to.be.bignumber.equal(
        new BN(2)
      );
    });
  });

  describe("Caste Vote", function () {
    it("Caste Vote(True)", async function () {
      await time.advanceBlock();
      await this.gov.castVote(1, 1, { from: userAddress1 });
      const prop = await this.gov.proposals(1);
      expect(prop.forVotes).to.be.bignumber.equal(new BN("900"));
    });

    it("Caste Vote(False)", async function () {
      await time.advanceBlock();
      await this.gov.castVote(1, 0, { from: userAddress1 });
      const prop = await this.gov.proposals(1);
      expect(prop.againstVotes).to.be.bignumber.equal(new BN("900"));
    });

    it("Caste Vote(Try to vote again)", async function () {
      await time.advanceBlock();
      await this.gov.castVote(1, 0, { from: userAddress1 });
      await expectRevert(
        this.gov.castVote(1, 1, { from: userAddress1 }),
        "GovernorBravo::castVoteInternal: voter already voted"
      );
    });
  });
});
