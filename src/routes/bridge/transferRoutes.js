const router = require('express').Router();
const axios = require('axios');

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

const transfer = async (source,destination,amount,on_behalf_of,developer_fee,apiKey,idempotencyKey)=>{
    const {source_currency,source_payment_rail,from_address} = source;
    const {destination_currency, destination_payment_rail, external_account_id} = destination;

    try {
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
            const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, customer_id, endpoint) VALUES (?,?,'/transfers');",[idempotencyKey,on_behalf_of]);
        }
    } catch(e){
        console.log(e);
        return {
            status: false,
            msg: 'Ocurrió un error',
            data: e
        }
    }

};

//solicitud POST para iniciar un nuevo proceso de transferencia off-ramp
router.post('/',idempotencyMiddleware,(req,res)=>{

    res.status(200).json({
        status: true,
        msg: 'Transferencia iniciada'
    })

});


module.exports = router;
