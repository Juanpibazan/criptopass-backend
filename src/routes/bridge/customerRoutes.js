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

const handleExistingKYC = async (email,idempotencyKey,kyc_link_id,customer_id,kyc_link,tos_link,kyc_status,type,full_name,tos_status)=>{
    try {
        const pool = await connect();
        const checkedExistingKYC = await pool.query("SELECT * FROM kyc_links where id=?;",[kyc_link_id]);
        if(checkedExistingKYC[0].length===0){
        const insertedKYCResponse = await pool.query("INSERT INTO kyc_links(id,idempotency_key,full_name,email,type,kyc_link,tos_link,kyc_status,tos_status) VALUES (?,?,?,?,?,?,?,?,?);",[kyc_link_id,idempotencyKey,full_name,email,type,kyc_link,tos_link,kyc_status,tos_status]);
        if(insertedKYCResponse[0].affectedRows===1){
            const existingIdempotencyKey = await pool.query("SELECT * FROM idempotency_keys where email=? and endpoint='/kyc_links';",[email]);
            if(existingIdempotencyKey[0].length>0){
                        const updateIdempotencyResponse = await pool.query("UPDATE idempotency_keys set customer_id=? where email=? and endpoint='/kyc_links';",[customer_id,email]);
                        if(updateIdempotencyResponse[0].affectedRows>0){
                            const foundCustomerResponse = await pool.query("SELECT * FROM customers where id=?;",[customer_id]);
                            if(foundCustomerResponse[0].length===0){
                                const insertedCustomerResponse = await pool.query("INSERT INTO customers (id,full_name,email,status,type) VALUES (?,?,?,?,?);",[customer_id,full_name,email,kyc_status,type]);
                                const insertedUserResponse = await pool.query("UPDATE criptopass_users SET customer_id=?, kyc_status=? WHERE email=?;",[customer_id, kyc_status, email]);

                                if(insertedCustomerResponse[0].affectedRows===1 && insertedUserResponse[0].affectedRows===1){
                                    return {
                                        status: 200,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}`
                                    };
                                } else{
                                    return {
                                        status: 403,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al crear customer en la base de datos.`,
                
                                    };
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
                                    const {first_name,last_name} = customerApiResponse.data;
                                    const new_email = customerApiResponse.data.email;
                                    const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=? where id=?;",[first_name,last_name,new_email,kyc_status,customer_id]);
                                    if(updatedCustomerResponse[0].affectedRows>0){
                                        return {
                                            status: 200,
                                            msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Se actualizaron datos del customer en la base de datos.`
                                        };
                                    } else{
                                        return {
                                            status:403,
                                            msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al actualizar los datos del customer en la base de datos.`
                                        };
                                    }
                                } else{
                                    return {
                                        status: customerApiResponse.status,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al traer información del customer`
                                    };
                                }

                            }
                        } else{
                            console.log('Ocurrió un error: Record not updated inside the idempotency_keys table.');
                            return {
                                status: 403,
                                msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}, pero no se logró guardar la info de la idempotency key en la base de datos`
                            }; 
                        }
                    }

                    } else {
                        console.log('Error with db, while updating kyc_links table')
                        return {
                            status: 403,
                            msg:'Database error'
                        };
                    }
        } else{
            const existingIdempotencyKey = await pool.query("SELECT * FROM idempotency_keys where email=? and endpoint='/kyc_links';",[email]);
            if(existingIdempotencyKey[0].length>0){
                        const updateIdempotencyResponse = await pool.query("UPDATE idempotency_keys set customer_id=? where email=? and endpoint='/kyc_links';",[customer_id,email]);
                        if(updateIdempotencyResponse[0].affectedRows>0){
                            const foundCustomerResponse = await pool.query("SELECT * FROM customers where id=?;",[customer_id]);
                            if(foundCustomerResponse[0].length===0){
                                const insertedCustomerResponse = await pool.query("INSERT INTO customers (id,full_name,email,status,type) VALUES (?,?,?,?,?);",[customer_id,full_name,email,kyc_status,type]);
                                const insertedUserResponse = await pool.query("UPDATE criptopass_users SET customer_id=?, kyc_status=? WHERE email=?;",[customer_id, kyc_status, email]);

                                if(insertedCustomerResponse[0].affectedRows===1 && insertedUserResponse[0].affectedRows===1){
                                    return {
                                        status: 200,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}`
                                    };
                                } else{
                                    return {
                                        status: 403,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al crear customer en la base de datos.`,
                
                                    };
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
                                    const {first_name,last_name} = customerApiResponse.data;
                                    const new_email = customerApiResponse.data.email;
                                    const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=? where id=?;",[first_name,last_name,new_email,kyc_status,customer_id]);
                                    if(updatedCustomerResponse[0].affectedRows>0){
                                        return {
                                            status: 200,
                                            msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Se actualizaron datos del customer en la base de datos.`
                                        };
                                    } else{
                                        return {
                                            status:403,
                                            msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al actualizar los datos del customer en la base de datos.`
                                        };
                                    }
                                } else{
                                    return {
                                        status: customerApiResponse.status,
                                        msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}. Hubo un problema al traer información del customer`
                                    };
                                }

                            }
                        } else{
                            console.log('Ocurrió un error: Record not updated inside the idempotency_keys table.');
                            return {
                                status: 403,
                                msg:`Esta es la información para el kyc_link_id: ${kyc_link_id}, pero no se logró guardar la info de la idempotency key en la base de datos`
                            }; 
                        }
                    }          
        }         
    } catch(e){
        console.log('Ocurrió un error: ',e);
        return {
            status: 500,
            msg: 'Ocurrió un error',
            data: e
        };
    }
};

const createKYCLlink = async (idempotencyKey, fullName, email, type, endorsements, apiKey)=>{
    try {
        const response = await axios({
            method:'post',
            url:'https://api.bridge.xyz/v0/kyc_links',
            data: endorsements.length===0 ? {
                full_name: fullName,
                email,
                type
            } : {
                full_name: fullName,
                email,
                type,
                endorsements
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
                const queryResponse = await pool.query("INSERT INTO kyc_links(id,idempotency_key,full_name,email,type,kyc_link,tos_link,kyc_status,tos_status) VALUES (?,?,?,?,?,?,?,?,?);",[response.data.id,idempotencyKey,fullName,email,type,response.data.kyc_link,response.data.tos_link,response.data.kyc_status,response.data.tos_status]);
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
        const {data} = e.response;
        if(data.code==='duplicate_record'){
            const {email,customer_id,full_name,id,kyc_link,tos_link,kyc_status,tos_status,type} = data.existing_kyc_link;
            const existingKYC = handleExistingKYC(email,idempotencyKey,id,customer_id,kyc_link,tos_link,kyc_status,type,full_name,tos_status);
            return {
                status: existingKYC.status,
                msg: existingKYC.msg,
                data
            }
        }
        return {
            status: false,
            msg: 'Ocurrió un error--',
            data:e.response.data.msg.data
        }
    }
};

//solicitud POST para crear un kyc_link

router.post('/kyc_links', verifyTokenMiddleware, idempotencyMiddleware, async (req,res)=>{
    const {fullName, email, type, endorsements} = req.body;
    //const idempotencyKey = req.header("Idempotency-Key");
    const idempotencyKey = req.idempotencyKey;
    //const response = await createKYCLlink(createUUID(),fullName,email,type, process.env.BRIDGE_API_KEY);
    const response = await createKYCLlink(idempotencyKey,fullName,email,type, endorsements, process.env.BRIDGE_API_KEY);
    if(response.status){
        res.status(response.status).json({
            status:response.status===200 ? true : false,
            msg:response.msg,
            data:response.data
        });
    } else {
        res.status(500).json({
            status:false,
            msg: response
        });
    }

});

//solicitud GET para retornar info referente a un kyc_link_id específico

router.get('/kyc_links/', verifyTokenMiddleware, async (req,res)=>{
    const {email} = req.query;
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
                                    console.log('INFO ABOUT CUSTOMER: ',customerApiResponse.data);
                                    const {first_name,last_name,new_email} = customerApiResponse.data;
                                    const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=? where id=?;",[first_name,last_name,new_email,kyc_status,customer_id]);
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
                            const updatedCustomerResponse = await pool.query("UPDATE customers SET first_name=?,last_name=?,email=?,status=? where id=?;",[first_name,last_name,new_email,kyc_status,customer_id]);
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
        } else{
            res.status(204).json({
                status: true,
                msg:'No KYC link record found in db.',
                data: 'not started'
            });
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

//solicitud GET para retornar info referente a un customer_id específico

router.get('/:customer_id', verifyTokenMiddleware, async (req,res)=>{
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
            const sepa_endorsement = apiResponse.data.endorsements.find((item)=>item.name==='sepa');
            const pool = await connect();
            const updatedUserResponse = await pool.query("UPDATE criptopass_users set sepa_kyc_status=? where customer_id=?;",[sepa_endorsement.status,customer_id]);
            if(updatedUserResponse[0].affectedRows>0){
                res.status(apiResponse.status).json({
                    status: true,
                    msg: 'Cliente encontrado',
                    data: apiResponse.data
                });
            }else{
                res.status(apiResponse.status).json({
                    status: true,
                    msg: 'Cliente encontrado pero no se pudo actualizar SEPA KYC status',
                    data: apiResponse.data
                });
            }
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

//solicitud GET para crear un kyc link con el objetivo de habilitar transferencias SEPA
router.get('/sepa_kyc_links/:customer_id', verifyTokenMiddleware,async (req,res)=>{
    const {customer_id} = req.params;
    try{
        const pool = await connect();
        const generatedSepaKycLink = await axios({
            method:'get',
            url:`https://api.bridge.xyz/v0/customers/${customer_id}/kyc_link?endorsement=sepa`,
            headers:{
                "Content-Type":"application/json",
                "Api-Key": `${process.env.BRIDGE_API_KEY}`
            }
        });
        if(generatedSepaKycLink.status===200){
            const updatedKycLinkRow = await pool.query("UPDATE kyc_links set sepa_kyc_link=? where customer_id=?;",[generatedSepaKycLink.data.url,customer_id]);
            if(updatedKycLinkRow[0].affectedRows>0){
                const updatedUser = await pool.query("",[]);
                res.status(200).json({
                    status: true,
                    msg:`KYC Link generado para SEPA para el customer: ${customer_id}`,
                    data:{
                        sepa_kyc_link: generatedSepaKycLink.data.url
                    }
                });
            }
            else{
                res.status(503).json({
                    status: true,
                    msg:'Error al guardar el KYC link en la base de datos!',
                    data:{
                        sepa_kyc_link: generatedSepaKycLink.data.url
                    }
                });
            }
        } else{
            res.status(generatedSepaKycLink.status).json({
                status: false,
                msg: 'Error al generar el KYC Link para SEPA!',
                data: generatedSepaKycLink.data
            });
        }
    }
    catch(e){
        res.status(500).json({
            status: false,
            msg:'Ocurrió un error',
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

//solicitud POST para crear una US external account para un cliente específico 
router.post('/:customer_id/external_accounts',verifyTokenMiddleware,idempotencyMiddleware, async (req,res)=>{
    const idempotencyKey = req.idempotencyKey;
    const {customer_id} = req.params;
    const {bank_name,account_number,routing_number,account_name,account_owner_name,address,account_type} = req.body;
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
            const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, customer_id, endpoint) VALUES (?,?,'/external_accounts');",[idempotencyKey,customer_id]);
            if(idempotencyInsertResponse[0].affectedRows===1){
                console.log('Record inserted into idempotency_keys table!');
                const externalAccountInsertResponse = address.street_line_2 !== '' ? await pool.query("INSERT INTO external_accounts (id,bank_name,account_number,routing_number,account_name,account_owner_name,street_line_1,street_line_2,city,state,postal_code,country,customer_id,account_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?);",[apiResponse.data.id,bank_name,account_number,routing_number,account_name,account_owner_name,address.street_line_1, address.street_line_2, address.city, address.state, address.postal_code, address.country,customer_id,account_type])
                                                    : await pool.query("INSERT INTO external_accounts (id,bank_name,account_number,routing_number,account_name,account_owner_name,street_line_1,city,state,postal_code,country,customer_id,account_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);",[apiResponse.data.id,bank_name,account_number,routing_number,account_name,account_owner_name,address.street_line_1, address.city, address.state, address.postal_code, address.country,customer_id,account_type]) ;
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


//solicitud POST para crear una SEPA external account para un cliente específico 
router.post('/:customer_id/external_accounts/sepa',verifyTokenMiddleware,idempotencyMiddleware, async (req,res)=>{
    const idempotencyKey = req.idempotencyKey;
    const {customer_id} = req.params;
    const {bic,account_number,account_type, account_owner_type,first_name,last_name,business_name,account_owner_name,address,iso_country_code} = req.body;
    try{
        const apiResponse = await axios({
            method:'post',
            url:`https://api.bridge.xyz/v0/customers/${customer_id}/external_accounts`,
            data:{
                currency:'eur',
                account_type,
                iban:{
                    account_number,
                    bic,
                    country: iso_country_code
                },
                account_owner_type,
                first_name,
                last_name,
                business_name: business_name !=='' ? business_name : null,
                account_owner_name,
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
            const idempotencyInsertResponse = await pool.query("INSERT INTO idempotency_keys (idempotency_key, customer_id, endpoint) VALUES (?,?,'/external_accounts');",[idempotencyKey,customer_id]);
            if(idempotencyInsertResponse[0].affectedRows===1){
                console.log('Record inserted into idempotency_keys table!');
                const externalAccountInsertResponse = await pool.query("INSERT INTO external_accounts (id,account_number,account_owner_name,street_line_1,street_line_2,city,state,postal_code,country,customer_id,account_type,account_owner_type,first_name,last_name,business_name,iso_country_code,bic) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);",[apiResponse.data.id,account_number,account_owner_name,address.street_line_1, address.street_line_2, address.city, address.state, address.postal_code, address.country,customer_id,account_type,account_owner_type,first_name,last_name,business_name,iso_country_code,bic]);
                if(externalAccountInsertResponse[0].affectedRows===1){
                    console.log('Record inserted into the external_accounts table!');
                    res.status(apiResponse.status).json({
                        status: true,
                        msg:'External account SEPA creada',
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

//solicitud POST para agregar destinatario
router.post('/destinatarios',verifyTokenMiddleware, async (req,res)=>{
    const {destiny_external_account_id,destiny_customer_id, destiny_customer_alias,origin_customer_id} = req.body;
    try{
        const pool = await connect();
        const destinatarioInsertedResponse = await pool.query("INSERT INTO destinatarios (destiny_external_account_id,destiny_customer_id,destiny_customer_alias,origin_customer_id) VALUES(?,?,?,?);",[destiny_external_account_id,destiny_customer_id,destiny_customer_alias,origin_customer_id]);
        if(destinatarioInsertedResponse[0].affectedRows>0){
            res.status(201).json({
                status: true,
                msg: `Se agregó correctamente al destinatario: ${destiny_customer_alias}`,
            });
        } else{
            res.status(400).json({
                status: false,
                msg:`Ocurrió un error al agregar al destinatario: ${destiny_customer_alias}`
            });
            
        }
    }
    catch(e){
        res.status(500).json({
            status: false,
            msg:'Ocurrió un error',
            data: e
        });

    }
});


//solicitud GET para traer todos los destinatarios asociados a un miso customer_id de origen

router.get('/destinatarios/:customer_id',verifyTokenMiddleware, async (req,res)=>{
    const {customer_id} = req.params;
    try{
        const pool = await connect();
        const destinatariosResponse = await pool.query("SELECT * FROM destinatarios where origin_customer_id=?;",[customer_id]);
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

//solicitud GET para encontrar customers a partir de su email

router.get('/find/:email', verifyTokenMiddleware, async (req,res)=>{
    const {email} = req.params;
    try{
        const pool = await connect();
        const foundCustomerResponse = await pool.query("Select a.*, b.id as external_account_id, b.bank_name , b.routing_number, b.account_number, b.account_name as account_type ,b.account_owner_name from customers a inner join external_accounts b on a.id=b.customer_id  where a.email like ?;",[`%${email}%`]);
        if(foundCustomerResponse[0].length===0){
            res.status(200).json({
                status:true,
                msg:'No se encontraron coincidencias',
                data:foundCustomerResponse[0]
            });
        } else{
            res.status(200).json({
                status:true,
                msg:`Se encontró al siguiente usuario: ${foundCustomerResponse[0][0].first_name} ${foundCustomerResponse[0][0].last_name}`,
                data:foundCustomerResponse[0]
            });
        }
    }
    catch(e){
        res.status(500).json({
            status: false,
            msg:'Ocurrió un error',
            data: e
        });
    }
});




module.exports=router;