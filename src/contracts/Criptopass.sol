//SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;
import "hardhat/console.sol";

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

    event TransferUSDT(address indexed sender, address indexed recipient, uint256 amount, string message, bool stepSuccess);

    constructor(address _token){
        owner = msg.sender;
        usdtTokenAddress = _token;
    }

    struct userName{
        string name;
        bool hasName;
    }

    struct transferRecord{
        string action;
        address sender;
        address recipient;
        uint256 amount;
        string message;
    }

    mapping(address => userName) names;
    mapping(address => transferRecord[]) transferHistory;

    function addName(string memory _name) public {
        userName storage newUserName = names[msg.sender];
        newUserName.name = _name;
        newUserName.hasName = true;
    }

    function transferUSDT(address payable _to, uint256 _amount, string memory _message) public returns (bool){
        IERC20 token = IERC20(usdtTokenAddress);
        console.log(_amount);
        require(token.balanceOf(msg.sender) >= _amount,"El balance del usuario no es suficiente.");
        bool success = token.transfer(_to, _amount);
        //require(success,"La transferencia fallo.");
        transferRecord memory newSend;
        newSend.action = '-';
        newSend.sender = msg.sender;
        newSend.recipient = _to;
        newSend.amount = _amount;
        newSend.message = _message;
        transferHistory[msg.sender].push(newSend);

        transferRecord memory newReceive;
        newReceive.action = '+';
        newReceive.sender = msg.sender;
        newReceive.recipient = _to;
        newReceive.amount = _amount;
        newReceive.message = _message;
        transferHistory[_to].push(newReceive);

        emit TransferUSDT(msg.sender, _to, _amount, _message, success);
        return success;

    }

        function transferUSDT2(address payable _to, uint256 _amount, string memory _message) public returns (bool){
        IERC20 token = IERC20(usdtTokenAddress);
        console.log(_amount);
        uint256 myBalance = token.balanceOf(msg.sender);
        bool verified = myBalance >= _amount;
        require(verified, "Saldo insuficiente");
        token.transfer(_to, _amount);
        //require(success,"La transferencia fallo.");
        transferRecord memory newSend;
        newSend.action = '-';
        newSend.sender = msg.sender;
        newSend.recipient = _to;
        newSend.amount = _amount;
        newSend.message = _message;
        transferHistory[msg.sender].push(newSend);

        transferRecord memory newReceive;
        newReceive.action = '+';
        newReceive.sender = msg.sender;
        newReceive.recipient = _to;
        newReceive.amount = _amount;
        newReceive.message = _message;
        transferHistory[_to].push(newReceive);

        emit TransferUSDT(msg.sender, _to, _amount, _message, verified);
        return true;

    }

    function transferUSDT3(address payable _to, uint256 _amount, string memory _message) public returns (bool) {
        IERC20 token = IERC20(usdtTokenAddress);

        // Debug: Log sender's balance and the amount
        uint256 myBalance = token.balanceOf(msg.sender);
        console.log("Sender balance: ", myBalance);
        console.log("Amount to send: ", _amount);

        // Ensure the amount is greater than zero
        require(_amount > 0, "Transfer amount must be greater than zero");

        // Ensure the sender has sufficient balance
        require(myBalance >= _amount, "Saldo insuficiente");

        // Attempt transfer
        (bool success, bytes memory returnData) = address(token).call(
            abi.encodeWithSignature("transfer(address,uint256)", _to, _amount)
        );
        console.log("Transfer success:", success);
        //console.log("Return data:", returnData);
        require(success, "Token transfer failed.");

        // Update transfer history
        transferRecord memory newSend;
        newSend.action = '-';
        newSend.sender = msg.sender;
        newSend.recipient = _to;
        newSend.amount = _amount;
        newSend.message = _message;
        transferHistory[msg.sender].push(newSend);

        transferRecord memory newReceive;
        newReceive.action = '+';
        newReceive.sender = msg.sender;
        newReceive.recipient = _to;
        newReceive.amount = _amount;
        newReceive.message = _message;
        transferHistory[_to].push(newReceive);

        emit TransferUSDT(msg.sender, _to, _amount, _message, success);
        return success;
    }

    function approveExpenditure(address _spender, uint256 _amount) public returns (bool){
        IERC20 token = IERC20(usdtTokenAddress);
        token.approve(_spender, _amount);
        return true;
    }


    function getBalance(address account) public view returns (uint256 ){
        IERC20 token = IERC20(usdtTokenAddress);
        return token.balanceOf(account);
    }


}