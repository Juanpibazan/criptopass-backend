const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Web3 = require('web3');
require('dotenv').config();

const signTxRoutes = require('./routes/web3/signTxRoutes');
const bridgeCustomerRoutes = require('./routes/bridge/customerRoutes');

const app = express();

app.use(cors({origin:'*'}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.set('port', process.env.PORT || 4000);

//const web3 = new Web3(process.env.LOCAL_GANACHE_RPC_URL);

app.use('/web3/signTx', signTxRoutes);
app.use('/bridge/customers',bridgeCustomerRoutes);

app.get('/', (req,res)=>{
    res.json({message:'Welcome to Web3'});
});

app.listen(app.get('port'), ()=>{
    console.log('Server running on port: ', app.get('port'));
});
