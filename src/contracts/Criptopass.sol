//SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract Criptopass {
    
    address public owner;
    address public usdtTokenAddress;

    constructor(address _token){
        owner = msg.sender;
        usdtTokenAddress = _token;
    }

    struct userName{
        string name;
        bool hasName;
    }

    struct transfer{
        string action;
        address sender;
        address recipient;
        uint256 amount;
        string message;
    }

    mapping(address => userName) names;
    mapping(address => transfer[]) transferHistory;

    function addName(string memory _name) public {
        userName storage newUserName = names[msg.sender];
        newUserName.name = _name;
        newUserName.hasName = true;
    }

    function transferUSDT(address _to, uint256 _amount, string memory _message) public returns (bool success){
        IERC20 token = IERC20(usdtTokenAddress);
        require(token.balanceOf(msg.sender) >= _amount,"El balance del usuario no es suficiente.");
        require(token.transfer(_to, _amount),"La transferencia fallo.");
        transfer memory newSend;
        newSend.action = '-';
        newSend.sender = msg.sender;
        newSend.recipient = _to;
        newSend.amount = _amount;
        newSend.message = _message;
        transferHistory[msg.sender].push(newSend);

        transfer memory newReceive;
        newReceive.action = '+';
        newReceive.sender = msg.sender;
        newReceive.recipient = _to;
        newReceive.amount = _amount;
        newReceive.message = _message;
        transferHistory[_to].push(newReceive);

        return true;

    }


}