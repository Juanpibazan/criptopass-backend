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
            if(response.status===200 || response.status===201){
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
            else{
                return {
                    status:response.status,
                    msg:`KYC link creation process with errors: ${response.data}`,
                    data: response.data
                }
            }
    } catch(e){
        console.log("Error llamando Bridge API: ",e.response.data);
        return e.response.data;
    }

};

//solicitud POST para crear un kyc_link

router.post('/kyc_links', async (req,res)=>{
    const {fullName, email, type} = req.body;
    const idempotencyKey = req.header("Idempotency-Key");
    const response = await createKYCLlink(createUUID(),fullName,email,type, process.env.BRIDGE_API_KEY);
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

//solicitud GET para retornar info referent a un kyc_link_id específico

router.get('/kyc_links/:email', async (req,res)=>{
    const {email} = req.params;
    try {
        const pool = await connect();
        const dbReponse = await pool.query("SELECT * FROM kyc_links where email=? order by created_at desc limit 1;",[email]);
        if(dbReponse[0].length>0){
            const kyc_link_id = dbReponse[0][0].id;
            const apiResponse = await axios({
                method:'get',
                url:`https://api.bridge.xyz/v0/kyc_links/${kyc_link_id}`,
                headers:{
                    "Content-Type":"application/json",
                    "Api-Key": `${process.env.BRIDGE_API_KEY}`
                }
            });
            if(apiResponse.status===200){
                console.log(apiResponse.data);
                const {kyc_status,tos_status} = apiResponse.data;
                if(dbReponse[0][0].kyc_status !== kyc_status || dbReponse[0][0].tos_status !== tos_status){
                    const updateResponse = await pool.query("UPDATE kyc_links set kyc_status=?,tos_status=? where id=?;",[kyc_status,tos_status,kyc_link_id]);
                    if(updateResponse[0].affectedRows>0){
                        res.status(apiResponse.status).json({
                            status: true,
                            msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}`,
                            data: apiResponse.data
                        });
                    } else {
                        res.status(503).json({
                            status: false,
                            msg:'Database error'
                        });
                    }
                }

            }
            else {
                console.log(apiResponse.data);
                res.status(apiResponse.status).json({
                    status: false,
                    msg:`Error al llamar a la Bridge API:: ${apiResponse.data.id}`,
                    data: apiResponse.data
                });
            }
        }
    } catch(e){
        console.log('Ocurrió un error: ',e);
        res.status(500).json({
            status: false,
            msg: e
        });
    }



});




module.exports=router;