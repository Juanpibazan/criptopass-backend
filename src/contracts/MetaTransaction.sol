// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MetaTransaction {
    mapping(address => uint256) public nonces;

    event MetaTransactionExecuted(
        address userAddress,
        address relayerAddress,
        bytes functionSignature
    );

    function executeMetaTransaction(
        address user,
        bytes memory functionSignature
    ) public returns (bytes memory) {
        require(verify(user, functionSignature), "Signature verification failed");

        // Increment nonce for user
        nonces[user]++;

        // Perform the actual function call
        (bool success, bytes memory result) = address(this).call(functionSignature);
        require(success, "Function call failed");

        emit MetaTransactionExecuted(user, msg.sender, functionSignature);

        return result;
    }


    function verify(
        address user,
        bytes memory functionSignature
    ) public view returns (bool) {
        // Recreate the hash
        bytes32 hash = keccak256(abi.encodePacked(user, functionSignature, nonces[user]));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));

        // Extract the signer address
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(functionSignature);
        address signer = ecrecover(ethSignedMessageHash, v, r, s);

        // Check if the signer matches the user
        return signer == user;
    }

    // Helper function to split the signature
    function splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

}
