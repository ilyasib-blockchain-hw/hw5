const { ethers } = require("hardhat");
const { expect } = require("chai");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("TugrikDao", function () {
    const mwei = 10 ** 6
    const day = 24 * 60 * 60

    async function deployTokenFixture() {
        const [userA, userB, userC, userD] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("TugrikToken");
        const tugrikToken = await Token.deploy();

        const TugrikDao = await ethers.getContractFactory("TugrikDao");
        const tugrikDao = await TugrikDao.deploy(tugrikToken.address);

        await tugrikToken.connect(userA).transfer(userB.address, 40 * mwei);
        await tugrikToken.connect(userA).transfer(userC.address, 35 * mwei);

        await tugrikToken.connect(userA).delegate(userA.address);
        await tugrikToken.connect(userB).delegate(userB.address);
        await tugrikToken.connect(userC).delegate(userC.address);

        return { tugrikToken, tugrikDao, userA, userB, userC, userD };
    }

    describe("Deployment", function () {
        it("Shouldn't create any proposal", async function () {
            const { tugrikDao } = await loadFixture(deployTokenFixture);

            expect(await tugrikDao.getProposalsNumber()).to.equal(0);
        });

        it("Should make balances from task", async function () {
            const { tugrikToken, userA, userB, userC } = await loadFixture(deployTokenFixture);

            expect(await tugrikToken.balanceOf(userA.address)).to.equal(25 * mwei);
            expect(await tugrikToken.balanceOf(userB.address)).to.equal(40 * mwei);
            expect(await tugrikToken.balanceOf(userC.address)).to.equal(35 * mwei);
        });
    });

    describe("Create proposal", function () {
        it("Should create a proposal", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.ProposalCreated(null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.deathTime).to.equal(await time.latest() + 3 * day);
            expect(await tugrikDao.getProposalsNumber()).to.equal(1);
            expect(await tugrikDao.getProposalDeathTime(hash)).to.equal(await time.latest() + 3 * day);
            expect(await tugrikDao.getProposalState(hash)).to.equal(0);
            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([0, 0])
        });

        it("Should create a proposal if 3 proposals already created, but one is expired", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            for (const [i, owner] of [userA, userB, userC].entries()) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Item Sample ${i}`));
                await tugrikDao.connect(owner).createProposal(hash);
                await time.increase(day);
            };

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 3"));
            await tugrikDao.connect(userA).createProposal(hash);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.ProposalCreated(hash, null));

            expect(event.args.hash).to.equal(hash);
            expect(await tugrikDao.getProposalsNumber()).to.equal(3);

            const [realesed] = await tugrikDao.queryFilter(tugrikDao.filters.ProposalFinished(null, null));

            expect(realesed.args.hash).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 0")));
            expect(realesed.args.state).to.equal(3);
        });

        it("Should be reverted when proposal already created", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));

            await tugrikDao.connect(userA).createProposal(hash);

            await expect(tugrikDao.connect(userA).createProposal(hash)).to.be.revertedWith("TugrikDao: Proposal already created");
        });

        it("Should be reverted when not enough balance", async function () {
            const { tugrikDao, userD } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));

            await expect(tugrikDao.connect(userD).createProposal(hash)).to.be.revertedWith("TugrikDao: Proposal creator's balance should be positive");
        });

        it("Should be reverted if 3 proposals already created", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            [userA, userB, userC].forEach(async (owner, i) => {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Item Sample ${i}`));
                await tugrikDao.connect(owner).createProposal(hash);
            });

            await expect(
                tugrikDao.connect(userA).createProposal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 3")))
            ).to.be.revertedWith("TugrikDao: Already created max number (3) of proposals");
        });
    });

    describe("Get proposal votes", async function () {
        it("Should correctly count votes", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userA).vote(hash, 0, 10 * mwei);
            await tugrikDao.connect(userB).vote(hash, 0, 20 * mwei);
            await tugrikDao.connect(userC).vote(hash, 1, 30 * mwei);

            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([30 * mwei, 30 * mwei]);
        });

        it("Should correctly count votes after delegate", async function () {
            const { tugrikToken, tugrikDao, userA, userB, userC, userD } = await loadFixture(deployTokenFixture);

            await tugrikToken.connect(userA).delegate(userD.address);
            await tugrikToken.connect(userB).delegate(userD.address);
            await tugrikToken.connect(userC).delegate(userD.address);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userD).vote(hash, 0, 100 * mwei);

            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([100 * mwei, 0]);
        });

        it("Should be reverted when proposal not exist", async function () {
            const { tugrikDao } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));

            await expect(tugrikDao.getProposalVotes(hash)).to.be.rejectedWith("TugrikDao: Unknown proposal");
        });
    });

    describe("Vote", function () {
        it("Should emit right event", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userA).vote(hash, 0, 10 * mwei);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.VoteForProposal(null, null, null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.voter).to.equal(userA.address);
            expect(event.args.size).to.equal(10 * mwei);
            expect(event.args.side).to.equal(0);
            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([10 * mwei, 0]);
        });

        it("Should be able to delegate all votes to another address", async function () {
            const { tugrikToken, tugrikDao, userA, userB, userC, userD } = await loadFixture(deployTokenFixture);

            await tugrikToken.connect(userA).delegate(userD.address);
            await tugrikToken.connect(userB).delegate(userD.address);
            await tugrikToken.connect(userC).delegate(userD.address);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userD).vote(hash, 0, 100 * mwei);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.VoteForProposal(null, null, null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.voter).to.equal(userD.address);
            expect(event.args.size).to.equal(100 * mwei);
            expect(event.args.side).to.equal(0);
            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([100 * mwei, 0]);
        });

        it("Should be able to vote second time if balance left", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));

            await tugrikDao.connect(userA).createProposal(hash);
            await tugrikDao.connect(userA).vote(hash, 0, 10 * mwei);
            await tugrikDao.connect(userA).vote(hash, 0, 10 * mwei);

            const [_, event] = await tugrikDao.queryFilter(tugrikDao.filters.VoteForProposal(null, null, null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.voter).to.equal(userA.address);
            expect(event.args.size).to.equal(10 * mwei);
            expect(event.args.side).to.equal(0);
            expect(await tugrikDao.getProposalVotes(hash)).to.deep.equal([20 * mwei, 0]);
        });

        it("Should be reverted when vote size is 0", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await expect(tugrikDao.connect(userA).vote(hash, 0, 0)).to.be.rejectedWith("TugrikDao: Vote size must be positive");
        });

        it("Should be reverted when proposal doesn't exists", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));

            await expect(tugrikDao.connect(userA).vote(hash, 0, 10 * mwei)).to.be.revertedWith("TugrikDao: Unknown proposal");
        });

        it("Should be reverted when proposal is expired", async function () {
            const { tugrikDao, userA } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await time.increase(4 * day);

            await expect(tugrikDao.connect(userA).vote(hash, 0, 10 * mwei)).to.be.revertedWith("TugrikDao: Proposal is expired");
        });

        it("Should be reverted when voter hasn't enough balance", async function () {
            const { tugrikDao, userC, userD } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userC).createProposal(hash);

            await expect(tugrikDao.connect(userD).vote(hash, 0, 10 * mwei)).to.be.revertedWith("TugrikDao: Voter must have enough money for vote");
        });

        it("Should be reverted after delegate", async function () {
            const { tugrikToken, tugrikDao, userA, userD } = await loadFixture(deployTokenFixture);

            await tugrikToken.connect(userA).delegate(userD.address);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await expect(tugrikDao.connect(userA).vote(hash, 0, 100 * mwei)).to.be.revertedWith("TugrikDao: Voter must have enough money for vote");
        });

        it("Should be reverted if delegate was after proposal", async function () {
            const { tugrikToken, tugrikDao, userA, userB, userC, userD } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikToken.connect(userA).delegate(userD.address);
            await tugrikToken.connect(userB).delegate(userD.address);
            await tugrikToken.connect(userC).delegate(userD.address);

            await expect(tugrikDao.connect(userD).vote(hash, 0, 100 * mwei)).to.be.revertedWith("TugrikDao: Voter must have enough money for vote");
        });

        it("Shouldn't be able to vote if proposal is finished", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userA).vote(hash, 0, 25 * mwei);
            await tugrikDao.connect(userB).vote(hash, 0, 40 * mwei);

            await expect(tugrikDao.connect(userC).vote(hash, 0, 35 * mwei)).to.be.revertedWith("TugrikDao: Proposal already finished");
        });

        it("Should emit event when quorum is reached and proposal accepted", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userA).vote(hash, 0, 10 * mwei);
            await tugrikDao.connect(userB).vote(hash, 0, 20 * mwei);
            await tugrikDao.connect(userC).vote(hash, 0, 30 * mwei);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.ProposalFinished(null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.state).to.equal(1);
        });

        it("Should emit event when quorum is reached and proposal rejected", async function () {
            const { tugrikDao, userA, userB, userC } = await loadFixture(deployTokenFixture);

            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Item Sample 1"));
            await tugrikDao.connect(userA).createProposal(hash);

            await tugrikDao.connect(userA).vote(hash, 1, 10 * mwei);
            await tugrikDao.connect(userB).vote(hash, 1, 20 * mwei);
            await tugrikDao.connect(userC).vote(hash, 1, 30 * mwei);

            const [event] = await tugrikDao.queryFilter(tugrikDao.filters.ProposalFinished(null, null));

            expect(event.args.hash).to.equal(hash);
            expect(event.args.state).to.equal(2);
        });
    });
});