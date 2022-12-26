# Blockchain ITMO HW5 Project

## Deploy

You can deploy DAO and token to your local blockchain via [script](./scripts/deploy.js).

## Run tests

  1) Run `npm install`
  2) Run `npx hardhat test`

## Output example

```
  TugrikDao
    Deployment
      ✔ Shouldn't create any proposal (862ms)
      ✔ Should make balances from task
    Create proposal
      ✔ Should create a proposal
      ✔ Should create a proposal if 3 proposals already created, but one is expired (51ms)
      ✔ Should be reverted when proposal already created
      ✔ Should be reverted when not enough balance
      ✔ Should be reverted if 3 proposals already created
    Get proposal votes
      ✔ Should correctly count votes (46ms)
      ✔ Should correctly count votes after delegate (53ms)
      ✔ Should be reverted when proposal not exist
    Vote
      ✔ Should emit right event
      ✔ Should be able to delegate all votes to another address (46ms)
      ✔ Should be able to vote second time if balance left
      ✔ Should be reverted when vote size is 0
      ✔ Should be reverted when proposal doesn't exists
      ✔ Should be reverted when proposal is expired
      ✔ Should be reverted when voter hasn't enough balance
      ✔ Should be reverted after delegate
      ✔ Should be reverted if delegate was after proposal
      ✔ Shouldn't be able to vote if proposal is finished (46ms)
      ✔ Should emit event when quorum is reached and proposal accepted
      ✔ Should emit event when quorum is reached and proposal rejected

  TigrikToken contract
    Deployment
      ✔ Should have 100 tokens after init
      ✔ Should assign the total supply of tokens to the owner
    Transactions
      ✔ Should transfer tokens between accounts
      ✔ should emit Transfer events
      ✔ Should fail if sender doesn't have enough tokens


  27 passing (2s)
```