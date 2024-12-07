const router = require('express').Router();

const { ethers } = require("ethers");
require('dotenv').config();

//metatransaction contract address: 0x7531D2B4E6fb8C7dB4fC7F9B28EE42F1D7C043A5
//paypal contract address: 0xCE3f7499FE31a49518Ca4d868719330df64AD47b

const signMsgCreateRequest = ()=>{
    // Example inputs
    const userAddress = "0x2bD86D5B9cDbaed34E7BBe74392848D46bd4C57C"; // Replace with the user's wallet address
    const amount = ethers.utils.parseUnits("1", 18); // Amount in wei
    const message = "Payment request"; // Request message
    const contractAddress = "0xCE3f7499FE31a49518Ca4d868719330df64AD47b"; // Deployed contract address
    const nonce = 1; // Current nonce of the user (tracked on-chain)

    // Provider and wallet (user's private key for signing)
    const provider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_GANACHE_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider); // Replace with user's private key

    // Hash the message to sign
    const hashMessage = ethers.utils.solidityKeccak256(
    ["address", "uint256", "string", "address", "uint256"],
    [userAddress, amount, message, contractAddress, nonce]
    );

    // Sign the hash
    async function signMessage() {
    const hashToSign = ethers.utils.arrayify(hashMessage); // Convert hash to bytes array
    const signature = await wallet.signMessage(hashToSign);
    console.log("Signature:", signature);
    return signature;
    }

    signMessage().then((signature) => {
    console.log("Signed Message:", signature);
    });
};


router.post('/signMsgCreateRequest', async (req,res)=>{
    // await signMsgCreateRequest();
    res.json({msg:'signature should be returned here'});
});


const signAddName = (signerAddress,name)=>{
    // Example inputs
    //const signerAddress = "0x698583792e0091f311b4bfdb789601E07C8dc936"; // Replace with the user's wallet address
    //const amount = ethers.utils.parseUnits("1", 18); // Amount in wei
    //const message = "Payment request"; // Request message
    //const contractAddress = "0xCE3f7499FE31a49518Ca4d868719330df64AD47b"; // Deployed contract address
    const nonce = 1; // Current nonce of the user (tracked on-chain)

    // Provider and wallet (user's private key for signing)
    //const provider = new ethers.JsonRpcProvider(process.env.LOCAL_GANACHE_RPC_URL);
    const provider = new ethers.JsonRpcProvider('http://localhost:7545');
    //const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider); // Replace with user's private key
    console.log('provider: ',provider);

    // Hash the message to sign
    const hashMessage = ethers.utils.solidityKeccak256(
    ["address", "string", "uint256"],
    [signerAddress, name, nonce]
    );

    // Sign the hash
    async function signMessage() {
    const hashToSign = ethers.utils.arrayify(hashMessage); // Convert hash to bytes array
    const signature = await wallet.signMessage(hashToSign);
    console.log("Signature:", signature);
    return signature;
    }

    signMessage().then((signature) => {
    console.log("Signed Message:", signature);
    //return signature;
    });
};

router.post('/signAddName', (req,res)=>{
    const {signerAddress, name} = req.body;
    try {
        const signature =  signAddName(signerAddress, name);
        if(signature){
            res.status(200).json({
                msg: 'success',
                data:signature
            });
        } else{
            res.status(404).json({
                msg:'Signature not found'
            });
        }

    }
    catch(e){
        res.status(500).json({
            msg:'An error ocurred',
            data: e
        })
    }

});

module.exports = router;