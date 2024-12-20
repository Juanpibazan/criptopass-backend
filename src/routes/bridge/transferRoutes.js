const router = require('express').Router();
const axios = require('axios');
const connect = require('../../db/connection');
const jwt = require('jsonwebtoken');
require('dotenv').config();

//middleware para verificar la idempotency key
async function idempotencyMiddleware(req, res, next) {
    const idempotencyKey = req.header("Idempotency-Key");
    //const userId = req.user.id; // Assume authentication middleware sets `req.user`
    const customer_id = req.params.customer_id ? req.params.customer_id : null;
    const email = req.body.email ? req.body.email : null;

    if (!idempotencyKey) {
        return res.status(400).json({ error: "Idempotency key is required" });
    }

    try {
        // Check if the key exists
        const pool = await connect();
        if(customer_id){
            const [rows] = await pool.query(
                "SELECT * FROM idempotency_keys WHERE idempotency_key = ? AND customer_id = ?",
                [idempotencyKey, customer_id]
            );
            if (rows.length > 0) {
                // If key exists, return the saved response
                res.status(403).json({
                    status: false,
                    msg: 'Idempotency key already exists',
    
                });
            }
        } else if(email){
            const [rows] = await pool.query(
                "SELECT * FROM idempotency_keys WHERE idempotency_key = ? AND email = ?",
                [idempotencyKey, email]
            );
            if (rows.length > 0) {
                // If key exists, return the saved response
                res.status(403).json({
                    status: false,
                    msg: 'Idempotency key already exists',
    
                });
            }
        }
        // Attach idempotency key details to the request for later use
        req.idempotencyKey = idempotencyKey;
        next();
    } catch (e) {
        console.error(err);
        res.status(500).json({
            status:false,
            msg: "Error interno del servidor",
            data: e
        });
    }
}

//middleware para verificar jwt
const verifyTokenMiddleware = (req,res,next)=>{
    const token = req.header('Authorization');
    if(!token){
        res.status(401).json({
            status: false,
            message: 'ERROR. Token incorrecto o no vigente'
        });
    }
    else{
        try {
            const decoded = jwt.verify(token.split(' ')[1],process.env.JWT_SECRET_KEY);
            console.log(decoded);
            req.email=token.email;
            next();
        }catch(e){
            res.status(401).json({
                status: false,
                message: 'ERROR. Token incorrecto o no vigente'
            });
        }
    }
  
};

const transfer = async (source,destination,amount,on_behalf_of,developer_fee,apiKey,idempotencyKey)=>{
    const {source_currency,source_payment_rail,from_address} = source;
    const {destination_currency, destination_payment_rail, external_account_id} = destination;

    try {
        const pool = await connect();
        const apiResponse = await axios({
            method:'post',
            url:'https://api.bridge.xyz/v0/transfers',
            data:{
                source:{
                    currency:source_currency,
                    payment_rail: source_payment_rail,
                    from_address

                },
                destination:{
                    currency: destination_currency,
                    payment_rail:destination_payment_rail,
                    external_account_id
                },
                amount,
                on_behalf_of,
                developer_fee
            },
            headers:{
                "Content-Type":"application/json",
                "Api-Key": `${apiKey}`,
                "Idempotency-Key": `${idempotencyKey}`
            }
        });
        if(apiResponse.status===201){
            console.log('This the response for creating a transfer:',apiResponse.data);
            const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, customer_id, endpoint) VALUES (?,?,'/transfers');",[idempotencyKey,on_behalf_of]);
            if(idempotencyInsertResponse[0].affectedRows===1){
                const transferInsertResponse = await pool.query("INSERT INTO transfers(id,state,amount, developer_fee,on_behalf_of,source_currency,source_payment_rail,from_address,destination_currency,destination_payment_rail,external_account_id,to_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?);",
                    [apiResponse.data.id,
                      apiResponse.data.state,
                      parseFloat(apiResponse.data.amount),
                      parseFloat(apiResponse.data.developer_fee),
                      apiResponse.data.on_behalf_of,
                      source_currency,
                      source_payment_rail,
                      from_address,
                      destination_currency,
                      destination_payment_rail,
                      external_account_id,
                      apiResponse.data.source_deposit_instructions.to_address
                    ]);
                if(transferInsertResponse[0].affectedRows===1){
                        console.log('Se insertaron correctamente los registros en ambas tablas(idempotency_keys y transfers');
                        return {
                            status: apiResponse.status,
                            msg:`Transfer with id ${apiResponse.data.id} initiated and records inserted into db tables`,
                            data: apiResponse.data
                        }
                } else{
                    console.log('No se insertaron correctamente los registros en ambas tablas(idempotency_keys y transfers');
                    return {
                        status: apiResponse.status,
                        msg:`Transfer with id ${apiResponse.data.id} initiated but records NOT inserted into db tables`,
                        data: apiResponse.data
                    }
                }
            }
            else{
                console.log('No se insertó correctamente el registro en la tabla idempotency_keys');
                return {
                    status: apiResponse.status,
                    msg:`Transfer with id ${apiResponse.data.id} initiated but record NOT inserted into db table idempotency_key`,
                    data: apiResponse.data
                }
            }
        } else {
            console.log('Error al iniciar la transfer');
            return {
                status: apiResponse.status,
                msg:`Error while initiating transfer process`,
                data: apiResponse.data
            }
        }
    } catch(e){
        console.log(e);
        return {
            status: 500,
            msg: 'Ocurrió un error',
            data: e
        }
    }

};

//solicitud POST para iniciar un nuevo proceso de transferencia off-ramp
router.post('/',verifyTokenMiddleware,idempotencyMiddleware, async (req,res)=>{
    const idempotencyKey = req.idempotencyKey;
    const {source, destination, amount, on_behalf_of, developer_fee} = req.body;
    const transferResponse = await transfer(source, destination, amount, on_behalf_of,developer_fee,process.env.BRIDGE_API_KEY,idempotencyKey);
        res.status(transferResponse.status).json({
            status: transferResponse.status===201 ? true : false,
            msg: transferResponse.msg,
            data: transferResponse.data
        });
});

router.post('/test', (req,res)=>{
    const {testField} = req.body;
    res.status(200).json({
        myDecOrStrField: testField
    });
});

module.exports = router;
