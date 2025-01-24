const router = require('express').Router();
const Web3 = require('web3');
require('dotenv').config();
const ABI = require('../../ABI/abi');

const web3 = new Web3.Web3('http://127.0.0.1:7545');

router.get('/:address', async (req,res)=>{
    const {address} = req.params;
    const tokenAddress = '0x3a67e567c20bd0076d7be7dbe7445b431ba73a89';
    const tokenABI = ABI;
    try{
        const tokenContract = new web3.eth.Contract(tokenABI,tokenAddress);
        let accountBalance = await tokenContract.methods.balanceOf(address).call();
        const accountBalanceInWei = web3.utils.toWei(accountBalance,'ether');
        accountBalance = accountBalance.toString();

        res.status(200).json({
            status: true,
            msg: 'Account Balance found.',
            data: {accountBalance}
        });
    } catch(e){
       console.log(e);
       res.status(500).json({
        status: false,
        msg: 'Internal error',
        data: e
    }); 
    }
});



module.exports = router;