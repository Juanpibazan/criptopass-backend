const router = require('express').Router();
const {v4: uuidv4} = require('uuid');
const axios = require('axios');
require('dotenv').config();

const connect = require('../../db/connection');

const createUUID = ()=>{
    return uuidv4();
};

const createKYCLlink = async (idempotencyKey, fullName, email, type, apiKey)=>{
    try {
        const response = await axios({
            method:'post',
            url:'https://api.bridge.xyz/v0/kyc_links',
            data:{
                full_name: fullName,
                email,
                type
            },
            headers:{
                "Content-Type":"application/json",
                "Api-Key": `${apiKey}`,
                "Idempotency-Key": `${idempotencyKey}`
            }
         });
            if(response.status===200){
                console.log(response.data);
                const pool = await connect();
                const queryResponse = await pool.query("INSERT INTO kyc_links(id,idempotency_key,full_name,email,type,kyc_status,tos_status) VALUES (?,?,?,?,?,?,?);",[response.data.id,idempotencyKey,fullName,email,type,response.data.kyc_status,response.data.tos_status]);
                if(queryResponse[0].affectedRows===1){
                    console.log(`KYC link ${response.data.id} added to table!`);
                    return {
                        status:response.status,
                        msg:'KYC link creation started successfully',
                        data: response.data
                    }
                }
                
            }
            else if(response.status===422){
                return {
                        status:response.status,
                        msg:`Idempotency key expired. pleasde create a new one`,
                        data: response.data
                }
                
            }else if(response.status.toString().startsWith('4')){
                return {
                    status:response.status,
                    msg:`KYC link creation process with errors: ${response.data}`,
                    data: response.data
                }
            }
    } catch(e){
        console.log("Error llamando Bridge API: ",e);
        return e;
    }

};

router.post('/kyc_links', (req,res)=>{
    const {idempotencyKey, fullName, email, type} = req.body;
    const response = createKYCLlink(createUUID(),fullName,email,type, process.env.BRIDGE_API_KEY);
    if(response.status){
        res.status(response.status).json({
            status:response.status===200 ? true : false,
            msg:response.msg,
            data:response.data
        });
    } else{
        res.status(500).json({
            status:false,
            msg: response
        });
    }

});


module.exports=router;