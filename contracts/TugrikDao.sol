//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract TugrikDao {
    uint256 public constant DEFAULT_TTL = 3 days;
    uint8 public constant DEFAULT_MAX_PROPOSALS = 3;

    ERC20Votes public token;

    enum ProposalState {
        Created,
        Accepted,
        Declined,
        Expired
    }

    enum VoteSide {
        For,
        Against
    }

    struct VotesCount {
        uint256 forVotes;
        uint256 againstVotes;
    }

    struct Proposal {
        ProposalState state;
        uint256 fromBlock;
        uint256 deathTime;
        VotesCount votesCount;
    }

    uint8 private currProposalIndex = 0;
    bytes32[DEFAULT_MAX_PROPOSALS] private proposalsQueue;

    mapping(bytes32 => Proposal) hashToProposal;
    mapping(bytes32 => mapping(address => VotesCount)) hashToVotes;

    event ProposalCreated(
        bytes32 indexed hash,
        uint256 fromBlock,
        uint256 deathTime
    );
    event VoteForProposal(
        bytes32 indexed hash,
        address indexed voter,
        uint256 size,
        VoteSide side
    );
    event ProposalFinished(bytes32 indexed hash, ProposalState state);

    modifier senderHasMoney() {
        require(
            token.balanceOf(msg.sender) > 0,
            "TugrikDao: Proposal creator's balance should be positive"
        );
        _;
    }

    modifier propNotExist(bytes32 _hash) {
        require(
            hashToProposal[_hash].fromBlock == 0 ||
                hashToProposal[_hash].deathTime < block.timestamp ||
                hashToProposal[_hash].state != ProposalState.Created,
            "TugrikDao: Proposal already created"
        );
        _;
    }

    modifier propCanBeCreated() {
        bytes32 currProposalHash = proposalsQueue[currProposalIndex];
        require(
            currProposalHash == 0 ||
                hashToProposal[currProposalHash].deathTime < block.timestamp ||
                hashToProposal[currProposalHash].state != ProposalState.Created,
            "TugrikDao: Already created max number (3) of proposals"
        );
        _;
    }

    modifier propExist(bytes32 _hash) {
        require(
            hashToProposal[_hash].fromBlock != 0,
            "TugrikDao: Unknown proposal"
        );
        _;
    }

    modifier propInProgress(bytes32 _hash) {
        require(
            hashToProposal[_hash].state == ProposalState.Created,
            "TugrikDao: Proposal already finished"
        );
        require(
            block.timestamp < hashToProposal[_hash].deathTime,
            "TugrikDao: Proposal is expired"
        );
        _;
    }

    modifier voteSizeIsPositive(uint256 _voteSize) {
        require(_voteSize != 0, "TugrikDao: Vote size must be positive");
        _;
    }

    modifier voterHasEnoughMoney(
        Proposal storage _proposal,
        VotesCount storage _votesCount,
        uint256 _voteSize
    ) {
        require(
            _votesCount.forVotes + _votesCount.againstVotes + _voteSize <=
                token.getPastVotes(msg.sender, _proposal.fromBlock),
            "TugrikDao: Voter must have enough money for vote"
        );
        _;
    }

    constructor(address _token) {
        token = ERC20Votes(_token);
    }

    // Creates proposal by keccak256 hash code.
    function createProposal(
        bytes32 _hash
    ) external senderHasMoney propNotExist(_hash) {
        Proposal memory proposal = _makeProposal();
        hashToProposal[_hash] = proposal;
        _updateState(_hash);

        emit ProposalCreated(_hash, proposal.fromBlock, proposal.deathTime);
    }

    // Allows to vote on existiong proposal.
    function vote(
        bytes32 _hash,
        VoteSide _side,
        uint256 _size
    )
        external
        propExist(_hash)
        propInProgress(_hash)
        voteSizeIsPositive(_size)
    {
        _makeVote(
            hashToProposal[_hash],
            hashToVotes[_hash][msg.sender],
            _side,
            _size
        );

        emit VoteForProposal(_hash, msg.sender, _size, _side);

        _finishProposal(_hash);
    }

    // Returns current proposal state by it hash.
    function getProposalState(
        bytes32 _hash
    ) external view propExist(_hash) returns (ProposalState) {
        return hashToProposal[_hash].state;
    }

    // Returns time of proposal ttl by it hash.
    function getProposalDeathTime(
        bytes32 _hash
    ) external view propExist(_hash) returns (uint256) {
        return hashToProposal[_hash].deathTime;
    }

    // Returns current voting state by proposal hash.
    function getProposalVotes(
        bytes32 _hash
    ) external view propExist(_hash) returns (VotesCount memory) {
        return hashToProposal[_hash].votesCount;
    }

    // Returns votes of sender by proposal hash.
    function getMyVotes(
        bytes32 _hash
    ) external view propExist(_hash) returns (VotesCount memory) {
        return hashToVotes[_hash][msg.sender];
    }

    // Returns number of proposals in progress.
    function getProposalsNumber() external view returns (uint8) {
        uint8 result = 0;

        for (uint8 i = 0; i < DEFAULT_MAX_PROPOSALS; i++) {
            if (
                proposalsQueue[i] != 0 &&
                hashToProposal[proposalsQueue[i]].state ==
                ProposalState.Created &&
                block.timestamp < hashToProposal[proposalsQueue[i]].deathTime
            ) {
                result++;
            }
        }

        return result;
    }

    // internal

    function _makeProposal()
        private
        propCanBeCreated
        returns (Proposal memory)
    {
        bytes32 currProposalHash = proposalsQueue[currProposalIndex];

        if (currProposalHash != 0) {
            hashToProposal[currProposalHash].state = ProposalState.Expired;
            emit ProposalFinished(currProposalHash, ProposalState.Expired);
        }

        return
            Proposal({
                state: ProposalState.Created,
                fromBlock: block.number,
                deathTime: block.timestamp + DEFAULT_TTL,
                votesCount: VotesCount({forVotes: 0, againstVotes: 0})
            });
    }

    function _updateState(bytes32 _hash) private {
        proposalsQueue[currProposalIndex] = _hash;
        currProposalIndex = (currProposalIndex + 1) % DEFAULT_MAX_PROPOSALS;
    }

    function _makeVote(
        Proposal storage _proposal,
        VotesCount storage _votesCount,
        VoteSide _side,
        uint256 _size
    ) private voterHasEnoughMoney(_proposal, _votesCount, _size) {
        if (_side == VoteSide.For) {
            _votesCount.forVotes += _size;
            _proposal.votesCount.forVotes += _size;
        } else if (_side == VoteSide.Against) {
            _votesCount.againstVotes += _size;
            _proposal.votesCount.againstVotes += _size;
        }
    }

    function _finishProposal(bytes32 _hash) private {
        Proposal storage proposal = hashToProposal[_hash];
        uint256 totalSupply = token.getPastTotalSupply(proposal.fromBlock);

        if (proposal.votesCount.forVotes > totalSupply / 2) {
            proposal.state = ProposalState.Accepted;
            emit ProposalFinished(_hash, ProposalState.Accepted);
        } else if (proposal.votesCount.againstVotes > totalSupply / 2) {
            proposal.state = ProposalState.Declined;
            emit ProposalFinished(_hash, ProposalState.Declined);
        }
    }
}
