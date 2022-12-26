//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract TugrikToken is ERC20Votes {
  constructor() ERC20("TugrikToken", "MNT") ERC20Permit("TugrikToken") {
    _mint(msg.sender, 0.1 gwei);
  }

  function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}