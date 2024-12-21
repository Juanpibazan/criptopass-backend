const router = require('express').Router();
const {v4: uuidv4} = require('uuid');
const axios = require('axios');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const connect = require('../../db/connection');

const createUUID = ()=>{
    return uuidv4();
};

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
                    const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, email, endpoint) VALUES (?,?,'/kyc_links');",[idempotencyKey,email]);
                    if(idempotencyInsertResponse[0].affectedRows===1){
                        console.log('Record inserted into idempotency_keys table!');
                        return {
                            status:response.status,
                            msg:'Creación de KYC link iniciada exitosamente!',
                            data: response.data
                        }
                    } else{
                        console.log('Ocurrió un error: Record not inserted into the idempotency_keys table.');
                        return {
                            status: response.status,
                            msg:'Creación de KYC link iniciada exitosamente, pero no se logró guardar la info de la idempotency key en la base de datos',
                            data:response.data
                        }; 
                    }
                } else{
                    console.log('Ocurrió un error: Record not inserted into the kyc_links table.');
                    return {
                        status: response.status,
                        msg:'Creación de KYC link iniciada exitosamente, pero no se logró guardar la info del kyc_link en la base de datos',
                        data:response.data
                    };      
                }

            }
                
            else if(response.status===422){
                return {
                        status:response.status,
                        msg:`Idempotency key expired. Please create a new one`,
                        data: response.data
                }
                
            }else if(response.status.toString().startsWith('4') && response.status!==422){
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
        console.log("Ocurrió un error: ",e.response.data);
        return {
            status: false,
            msg: 'Ocurrió un error',
            data:e.response.data
        }
    }

};

//solicitud POST para crear un kyc_link

router.post('/kyc_links', verifyTokenMiddleware,idempotencyMiddleware, async (req,res)=>{
    const {fullName, email, type} = req.body;
    //const idempotencyKey = req.header("Idempotency-Key");
    const idempotencyKey = req.idempotencyKey;
    //const response = await createKYCLlink(createUUID(),fullName,email,type, process.env.BRIDGE_API_KEY);
    const response = await createKYCLlink(idempotencyKey,fullName,email,type, process.env.BRIDGE_API_KEY);
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

//solicitud GET para retornar info referente a un kyc_link_id específico

router.get('/kyc_links/:email', verifyTokenMiddleware, async (req,res)=>{
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
                console.log(apiResponse);
                const {kyc_status,tos_status,customer_id, email, full_name, type} = apiResponse.data;
                if(dbReponse[0][0].kyc_status !== kyc_status || dbReponse[0][0].tos_status !== tos_status || dbReponse[0][0].customer_id !== customer_id){
                    const updateResponse = await pool.query("UPDATE kyc_links set kyc_status=?,tos_status=?, customer_id=? where id=?;",[kyc_status,tos_status, customer_id,kyc_link_id]);
                    //const updateIdempotencyResponse = await pool.query("UPDATE idempotency_keys set customer_id=? where email=? and endpoint='/kyc_links';",[customer_id,email]);
                    if(updateResponse[0].affectedRows>0){
                        const updateIdempotencyResponse = await pool.query("UPDATE idempotency_keys set customer_id=? where email=? and endpoint='/kyc_links';",[customer_id,email]);
                        if(updateIdempotencyResponse[0].affectedRows>0){
                            const foundCustomerResponse = await pool.query("SELECT * FROM customers where id=?;",[customer_id]);
                            if(foundCustomerResponse[0].length===0){
                                const insertedCustomerResponse = await pool.query("INSERT INTO customers (id,full_name,email,status,type) VALUES (?,?,?,?,?);",[customer_id,full_name,email,kyc_status,type]);
                                const insertedUserResponse = await pool.query("UPDATE criptopass_users SET customer_id=?, kyc_status=? WHERE email=?;",[customer_id, kyc_status, email]);

                                if(insertedCustomerResponse[0].affectedRows===1 && insertedUserResponse[0].affectedRows===1){
                                    res.status(apiResponse.status).json({
                                        status: true,
                                        msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}`,
                                        data: apiResponse.data
                                    });
                                } else{
                                    res.status(apiResponse.status).json({
                                        status: true,
                                        msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al crear customer en la base de datos.`,
                                        data: apiResponse.data
                                    });
                                }
                                
                            } else{
                                const customerApiResponse = await axios({
                                    method:'get',
                                    url:`https://api.bridge.xyz/v0/customers/${customer_id}`,
                                    headers:{
                                        "Content-Type":"application/json",
                                        "Api-Key": `${process.env.BRIDGE_API_KEY}`
                                    }
                                });
                                if(customerApiResponse.status=200){
                                    const {first_name,last_name,new_email} = customerApiResponse.data;
                                    const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=?;",[first_name,last_name,new_email,kyc_status]);
                                    if(updatedCustomerResponse[0].affectedRows>=0){
                                        res.status(apiResponse.status).json({
                                            status: true,
                                            msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Se actualizaron datos del customer en la base de datos.`,
                                            data: apiResponse.data
                                        });
                                    } else{
                                        res.status(apiResponse.status).json({
                                            status: true,
                                            msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al actualizar los datos del customer en la base de datos.`,
                                            data: apiResponse.data
                                        });
                                    }
                                } else{
                                    res.status(customerApiResponse.status).json({
                                        status: false,
                                        msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al traer información del customer`,
                                        data: {kyc_link_data:apiResponse.data, customer_error: customerApiResponse.data}
                                    });
                                }

                            }
                        } else{
                            console.log('Ocurrió un error: Record not updated inside the idempotency_keys table.');
                            res.status(apiResponse.status).json({
                                status: apiResponse.status,
                                msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}, pero no se logró guardar la info de la idempotency key en la base de datos`,
                                data:apiResponse.data
                            }); 
                        }

                    } else {
                        console.log('Error with db, while updating kyc_links table')
                        res.status(503).json({
                            status: false,
                            msg:'Database error'
                        });
                    }
                } else{
                    const foundExistingCustomerResponse = await pool.query("SELECT * FROM customers where id=?;",[customer_id]);
                    if(foundExistingCustomerResponse[0].length===0){
                        const insertedCustomerResponse = await pool.query("INSERT INTO customers (id,full_name,email,status,type) VALUES (?,?,?,?,?);",[customer_id,full_name,email,kyc_status,type]);
                        const insertedUserResponse = await pool.query("UPDATE criptopass_users SET customer_id=?,kyc_status=? WHERE email=?;",[customer_id, kyc_status,email]);
                        if(insertedCustomerResponse[0].affectedRows===1 && insertedUserResponse[0].affectedRows===1){
                            res.status(apiResponse.status).json({
                                status: true,
                                msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Se insertó correctamente el record del customer.`,
                                data: apiResponse.data
                            });
                        } else{
                            res.status(apiResponse.status).json({
                                status: true,
                                msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al crear customer en la base de datos.`,
                                data: apiResponse.data
                            });
                        }
                        
                    } else{
                        const customerApiResponse2 = await axios({
                            method:'get',
                            url:`https://api.bridge.xyz/v0/customers/${customer_id}`,
                            headers:{
                                "Content-Type":"application/json",
                                "Api-Key": `${process.env.BRIDGE_API_KEY}`
                            }
                        });
                        if(customerApiResponse2.status=200){
                            const {first_name,last_name} = customerApiResponse2.data;
                            const new_email = customerApiResponse2.data.email;
                            const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=?;",[first_name,last_name,new_email,kyc_status]);
                            if(updatedCustomerResponse[0].affectedRows>=0){
                                res.status(apiResponse.status).json({
                                    status: true,
                                    msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Se actualizaron datos del customer en la base de datos.`,
                                    data: apiResponse.data
                                });
                            } else{
                                res.status(apiResponse.status).json({
                                    status: true,
                                    msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al actualizar los datos del customer en la base de datos.`,
                                    data: apiResponse.data
                                });
                            }
                        } else{
                            res.status(customerApiResponse2.status).json({
                                status: false,
                                msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}. Hubo un problema al traer información del customer`,
                                data: {kyc_link_data:apiResponse.data, customer_error: customerApiResponse2.data}
                            });
                        }
                        /*res.status(apiResponse.status).json({
                            status: true,
                            msg:`Esta es la información para el kyc_link_id: ${apiResponse.data.id}`,
                            data: apiResponse.data
                        });*/
                    }

                }

            }
            else {
                console.log(apiResponse.data);
                res.status(apiResponse.status).json({
                    status: false,
                    msg:`Error al llamar a la Bridge API: ${apiResponse.data.id}`,
                    data: apiResponse.data
                });
            }
        }
    } catch(e){
        console.log('Ocurrió un error: ',e);
        res.status(500).json({
            status: false,
            msg: 'Ocurrió un error',
            data: e
        });
    }

});

//solicitud GET para retornar info referente a un customer específico

router.get('/:customer_id', verifyTokenMiddleware,async (req,res)=>{
    const {customer_id} = req.params;
    try {
        const apiResponse = await axios({
            method:'get',
            url:`https://api.bridge.xyz/v0/customers/${customer_id}`,
            headers:{
                "Content-Type":"application/json",
                "Api-Key": `${process.env.BRIDGE_API_KEY}`
            }
        });
        if(apiResponse.status === 200){
            console.log(apiResponse);
            res.status(apiResponse.status).json({
                status: true,
                msg: 'Cliente encontrado',
                data: apiResponse.data
            });
        }
        else{
            console.log(apiResponse);
            res.status(apiResponse.status).json({
                status: false,
                msg: 'Error al llamar a la Bridge API',
                data: apiResponse.data
            });
        }
    } catch(e){
        console.log(`Ocurrió un error: ${e}`);
        res.status(500).json({
            status: false,
            msg: 'Ocurrió un error',
            data: e
        });
    }

});

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

//solicitud POST para crear una external account para un cliente específico 
router.post('/:customer_id/external_accounts',verifyTokenMiddleware,idempotencyMiddleware, async (req,res)=>{
    const idempotencyKey = req.idempotencyKey;
    const {customer_id} = req.params;
    const {bank_name,account_number,routing_number,account_name,account_owner_name,address} = req.body;
    try{
        const apiResponse = await axios({
            method:'post',
            url:`https://api.bridge.xyz/v0/customers/${customer_id}/external_accounts`,
            data:{
                type: "raw",
                bank_name,  
                account_number,  
                routing_number,
                account_name,
                account_owner_name,
                active: true,
                address
            },
            headers:{
                "Content-Type":"application/json",
                "Api-Key": `${process.env.BRIDGE_API_KEY}`,
                "Idempotency-Key": `${idempotencyKey}`
            }
        });
        if(apiResponse.status === 200 || apiResponse.status===201){
            console.log(apiResponse);
            //falta el codigo para insertar en idempotency_keys y la info de la external account tambien
            const pool = await connect();
            const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, customer_id, endpoint) VALUES (?,?,'/:customer_id/external_accounts');",[idempotencyKey,customer_id]);
            if(idempotencyInsertResponse[0].affectedRows===1){
                console.log('Record inserted into idempotency_keys table!');
                const externalAccountInsertResponse = address.street_line_2 !== '' ? await pool.query("INSERT INTO external_accounts (id,bank_name,account_number,routing_number,account_name,account_owner_name,street_line_1,street_line_2,city,state,postal_code,country) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);",[apiResponse.data.id,bank_name,account_number,routing_number,account_name,account_owner_name,address.street_line_1, address.street_line_2, address.city, address.state, address.postal_code, address.country])
                                                    : await pool.query("INSERT INTO external_accounts (id,bank_name,account_number,routing_number,account_name,account_owner_name,street_line_1,city,state,postal_code,country) VALUES (?,?,?,?,?,?,?,?,?,?,?);",[apiResponse.data.id,bank_name,account_number,routing_number,account_name,account_owner_name,address.street_line_1, address.city, address.state, address.postal_code, address.country]) ;
                if(externalAccountInsertResponse[0].affectedRows===1){
                    console.log('Record inserted into the external_accounts table!');
                    res.status(apiResponse.status).json({
                        status: true,
                        msg:'External account creada',
                        data: apiResponse.data
                    });
                } else{
                    console.log('Ocurrió un error: Record not inserted into the external_accounts table.');
                    res.status(apiResponse.status).json({
                        status: true,
                        msg:'External account creada, pero no se logró guardar la info de la external account en la base de datos',
                    }); 
                }

            } else{
                console.log('Ocurrió un error: Record not inserted into the idempotency_keys table.');
                res.status(apiResponse.status).json({
                    status: true,
                    msg:'External account creada, pero no se logró guardar la info de la idempotency key en la base de datos',
                }); 
            }

        } else{
            res.status(apiResponse.status).json({
                status: false,
                msg:'No se pudo crear la external account, ocurrió un error',
                data: apiResponse.data
            }); 
        }
    }
    catch(e){
        console.log('Ocurrió un error: ',e);
        res.status(500).json({
            status:false,
            msg:`Ocurrió un error`,
            data: e
        });
    }

});

//solicitud GET para generar una idempotency key
router.get('/keys/createIdempotencyKey',(req,res)=>{
    const key = createUUID();
    res.status(200).json({
        msg: `${key}`
    });
});


//solicitud GET para traer todos los destinatarios asociados a un miso customer_id de origen

router.get('/destinatarios/:customer_id',verifyTokenMiddleware, async (req,res)=>{
    const {customer_id} = req.params;
    try{
        const pool = await connect();
        const destinatariosResponse = await pool.query("SELECT * FROM destinatarios where origin_cutomer_id=?;",[customer_id]);
        if(destinatariosResponse[0].length===0){
            res.status(200).json({
                status:true,
                msg:'No existen destinatarios registrados para este cliente de origen.',
                data:destinatariosResponse[0]
            });
        } else{
            res.status(200).json({
                status:true,
                msg:`Existen ${destinatariosResponse[0].length} destinatarios registrados para este cliente de origen.`,
                data:destinatariosResponse[0]
            });
        }
    } catch(e){
        res.status(500).json({
            status:false,
            msg:'Ocurrio un error.',
            data: e
        });
    }
});




module.exports=router;