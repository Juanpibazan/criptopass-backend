// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

//import "@openzeppelin/contracts/token/ERC20/extensions/ERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDT is ERC20 {

    uint256 private _totalSupply;

    constructor(uint256 initialSupply) ERC20("MockUSDT", "USDT"){
        _mint(msg.sender, initialSupply * 10 ** 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to,amount);
    }
    
}
