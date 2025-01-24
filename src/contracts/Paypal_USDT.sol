// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

//0x3813e82e6f7098b9583FC0F33a962D02018B6803 -> USDT Token contract address
//0xc2132D05D31c914a87C6611C10748AEb04B58e8F -> USDT Token contract address on Polygon mainnet
//0x2655783ed6c47Fd312D1204712A804821899E1A3 -> USDT Token contract address on Polygon Amoy testnet
//0x55d398326f99059fF775485246999027B3197955 -> USDT Token contract address on BNB Smart Chain mainnet
//0x337610d27c682E347C9cD60BD4b3b107C9d34dDd -> USDT Token on BNB Smart Chain Test network
//TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t -> USDT Token on TRC-20 TRON main network

contract Paypal {

    // Define the owner of the smart contract
    address public owner;
    address public usdtToken;

    constructor(address _usdtToken) {
        owner = msg.sender;
        usdtToken = _usdtToken;
    }

    // Structs and mappings for requests, transactions, and names
    struct request {
        address requestor;
        uint256 amount;
        string message;
        string name;
    }

    struct sendReceive {
        string action;
        uint256 amount;
        string message;
        address otherPartyAddress;
        string otherPartyName;
    }

    struct userName {
        string name;
        bool hasName;
    }

    mapping(address => userName) names;
    mapping(address => request[]) requests;
    mapping(address => sendReceive[]) history;

    // Add name to wallet address
    function addName(string memory _name) public {
        userName storage newUserName = names[msg.sender];
        newUserName.name = _name;
        newUserName.hasName = true;
    }

    // Create a request
    function createRequest(address user, uint256 _amount, string memory _message) public {
        request memory newRequest;
        newRequest.requestor = msg.sender;
        newRequest.amount = _amount;
        newRequest.message = _message;
        if (names[msg.sender].hasName) {
            newRequest.name = names[msg.sender].name;
        }
        requests[user].push(newRequest);
    }

    // Pay a request using USDT
    function payRequest(uint256 _request, uint256 _amount) public {
        require(requests[msg.sender].length > 0, "No requests for this user!");
        require(_request < requests[msg.sender].length, "Invalid request index!");
        request[] storage myRequests = requests[msg.sender];
        request storage payableRequest = myRequests[_request];

        require(_amount == payableRequest.amount, "Pay correct amount");

        IERC20 token = IERC20(usdtToken);

        // Check if the sender has enough USDT and approve the transfer
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient USDT balance");
        require(token.transferFrom(msg.sender, payableRequest.requestor, _amount), "USDT transfer failed");

        addHistory(msg.sender, payableRequest.requestor, payableRequest.amount, payableRequest.message);

        myRequests[_request] = myRequests[myRequests.length - 1];
        myRequests.pop();
    }

    // Add history for transactions
    function addHistory(address sender, address receiver, uint256 _amount, string memory _message) private {
        sendReceive memory newSend;
        newSend.action = '-';
        newSend.amount = _amount;
        newSend.message = _message;
        newSend.otherPartyAddress = receiver;
        if (names[receiver].hasName) {
            newSend.otherPartyName = names[receiver].name;
        }
        history[sender].push(newSend);

        sendReceive memory newReceive;
        newReceive.action = '+';
        newReceive.amount = _amount;
        newReceive.message = _message;
        newReceive.otherPartyAddress = sender;
        if (names[sender].hasName) {
            newReceive.otherPartyName = names[sender].name;
        }
        history[receiver].push(newReceive);
    }

    // Get all requests sent to a user
    function getMyRequests(address _user) public view returns (
        address[] memory,
        uint256[] memory,
        string[] memory,
        string[] memory
    ) {
        address[] memory addrs = new address[](requests[_user].length);
        uint256[] memory amnt = new uint256[](requests[_user].length);
        string[] memory msge = new string[](requests[_user].length);
        string[] memory nme = new string[](requests[_user].length);

        for (uint i = 0; i < requests[_user].length; i++) {
            request memory myRequest = requests[_user][i];
            addrs[i] = myRequest.requestor;
            amnt[i] = myRequest.amount;
            msge[i] = myRequest.message;
            nme[i] = myRequest.name;
        }
        return (addrs, amnt, msge, nme);
    }

    // Get all historic transactions a user has been part of
    function getMyHistory(address _user) public view returns (sendReceive[] memory) {
        return history[_user];
    }

    // Get the name of a user
    function getMyName(address _user) public view returns (userName memory) {
        return names[_user];
    }
}
