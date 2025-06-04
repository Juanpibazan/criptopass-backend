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
            const decoded = jwt.verify(token.split(' ')[1],process.env.JWT_SECRET);
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

const transfer = async (source,destination,amount,on_behalf_of,developer_fee,from_customer_id,apiKey,idempotencyKey)=>{
    const {source_currency,source_payment_rail,
        //from_address
    } = source;
    const {destination_currency,
        destination_payment_rail,
        external_account_id,
        wire_message=null
    } = destination;

    try {
        const pool = await connect();
        const apiResponse = await axios({
            method:'post',
            url:'https://api.bridge.xyz/v0/transfers',
            data:{
                source:{
                    currency:source_currency,
                    payment_rail: source_payment_rail,
                    //from_address

                },
                destination:{
                    currency: destination_currency,
                    payment_rail:destination_payment_rail,
                    external_account_id,
                    wire_message
                },
                amount,
                on_behalf_of,
                developer_fee,
                features:{
                    allow_any_from_address:true
                }
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
                const transferInsertResponse = await pool.query("INSERT INTO transfers(id,state,amount, developer_fee,on_behalf_of,source_currency,source_payment_rail,destination_currency,destination_payment_rail,external_account_id,to_address,final_amount,from_customer_id,wire_message) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?);",
                    [apiResponse.data.id,
                      apiResponse.data.state,
                      parseFloat(apiResponse.data.amount),
                      parseFloat(apiResponse.data.developer_fee),
                      apiResponse.data.on_behalf_of,
                      source_currency,
                      source_payment_rail,
                      destination_currency,
                      destination_payment_rail,
                      external_account_id,
                      apiResponse.data.source_deposit_instructions.to_address,
                      apiResponse.data.receipt.final_amount,
                      from_customer_id,
                      wire_message
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
    const {source, destination, amount, on_behalf_of, developer_fee,from_customer_id} = req.body;
    const transferResponse = await transfer(source, destination, amount, on_behalf_of,developer_fee,from_customer_id,process.env.BRIDGE_API_KEY,idempotencyKey);
        res.status(transferResponse.status).json({
            status: transferResponse.status===201 ? true : false,
            msg: transferResponse.msg,
            data: transferResponse.data
        });
});

//solicitud GET para traer todas las transferencias correspondientes al usuario que recibio la transferencia
router.get('/:customer_id',verifyTokenMiddleware , async (req,res)=>{
    const {customer_id} = req.params;
    const {limit} = req.query;
    try{
        const transfersResponse = await axios({
            method:'get',
            url:`https://api.bridge.xyz/v0/customers/${customer_id}/transfers?limit=${limit}`,
            headers:{
                "Content-Type":"application/json",
                "Api-Key": process.env.BRIDGE_API_KEY
            }
        });
        if(transfersResponse.status===200){
            if(transfersResponse.data.code==='not_found'){
                res.status(200).json({
                    status: true,
                    msg:`No hay transferencias recibidas por el usuario ${customer_id}`,
                    data:[]
                });
            } else {
                const pool = await connect();
                const transfersDbResponse = await pool.query("Select id, state from transfers where on_behalf_of=? order by created_at desc;",[customer_id]);
                if(transfersDbResponse[0].length===transfersResponse.length){
                    let transfersNotUpdated=[];
                    for (let index = 0; index < transfersDbResponse.length; index++) {
                        if(transfersResponse[index].state !== transfersDbResponse[0][index].state){
                            transfersNotUpdated.push({id:transfersResponse[index].id,state:transfersResponse[index].state});
                            const transferUpdatedResponse = await pool.query("UPDATE transfers set state=? where id=?;",[transfersResponse[index].state,transfersResponse[index].id]);
                            if(transferUpdatedResponse[0].affectedRows===1){
                                console.log(`Transferencia ${transfersResponse[index].id} actualizada!`);
                            } else{
                                console.log(`Transferencia ${transfersResponse[index].id} no pudo ser actualizado.`);
                            }
                        } 
                    }
                } else{
                    console.log('Hay diferencia en cantidad de transferencias entre api y base de datos.');
                }
                res.status(200).json({
                    status: true,
                    msg:`${transfersResponse.data.count} Transferencias comenzadas por el usuario ${customer_id}`,
                    data:transfersResponse.data.data
                });
            }

        } else{
            res.status(transfersResponse.data.status).json({
                status:false,
                msg:'Ocurrió un error',
                data: transfersResponse.data.message
            });
        }
    } catch(e){
        res.status(500).json({
            status:false,
            msg:'Ocurrió un error',
            data: e
        });
    }
});


//solicitud GET para traer todas las transferencias correspondientes al usuario que inicio las transferencias
router.get('/senders/:customer_id',verifyTokenMiddleware, async (req,res)=>{
    const {customer_id} = req.params;
    var {limit} = req.query;
    limit = parseIntnt(limit);
    try{
        const pool = await connect();
        const transfersDbResponse = await pool.query("SELECT a.*, b.full_name FROM transfers a left join customers b on a.on_behalf_of=b.id WHERE a.from_customer_id=? order by a.created_at desc limit ?;",[customer_id,limit]);
        if(transfersDbResponse[0].length>0){
            var awaitingFundsTransfers = transfersDbResponse[0].filter((item)=>{return (item.state==='awaiting_funds' || item.state==='payment_submitted')});
            //console.log('LENGTH: ', awaitingFundsTransfers.length);
            const transfersNotUpdated=[];
            for (let index = 0; index < awaitingFundsTransfers.length; index++) {
                //console.log('TESTING FOR LOOP: ',index);
                const apiResponse = await axios({
                    method:'get',
                    url:`https://api.bridge.xyz/v0/transfers/${awaitingFundsTransfers[index].id}`,
                    headers:{
                        "Content-Type":"application/json",
                        "Api-Key": process.env.BRIDGE_API_KEY
                    }
                });
                const transferResponse = apiResponse.data;
                if(apiResponse.status===200){
                    if(transferResponse.state !== awaitingFundsTransfers[index].state){
                        transfersNotUpdated.push({id:transferResponse.id,state:transferResponse.state});
                        const transferUpdatedResponse = await pool.query("UPDATE transfers set state=? where id=?;",[transferResponse.state,transferResponse.id]);
                        if(transferUpdatedResponse[0].affectedRows===1){
                            console.log(`Transferencia ${transferResponse.id} actualizada!`);
                        } else{
                            console.log(`Transferencia ${transferResponse.id} no pudo ser actualizada.`);
                        }
                    }
                } 
            }
            res.status(200).json({
                status: true,
                msg:`${transfersDbResponse[0].length} Transferencias comenzadas por el usuario ${customer_id}`,
                data:transfersDbResponse[0]
                });
            }
            else{
            res.status(200).json({
                status:true,
                msg:`No existen transferencias comenzadas por el usuario ${customer_id}`,
                data: []
            });
        }
    } catch(e){
        res.status(500).json({
            status:false,
            msg:'Ocurrió un error',
            data: e
        });
    }
});


router.post('/test', (req,res)=>{
    const {testField} = req.body;
    res.status(200).json({
        myDecOrStrField: testField
    });
});


module.exports = router;
