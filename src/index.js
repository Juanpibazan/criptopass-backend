const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Web3 = require('web3');
require('dotenv').config();

const signTxRoutes = require('./routes/web3/signTxRoutes');
const testRoutes = require('./routes/web3/testRoutes');
const bridgeCustomerRoutes = require('./routes/bridge/customerRoutes');
const bridgeTransferRoutes = require('./routes/bridge/transferRoutes');
const criptopassAuthRoutes = require('./routes/criptopass/authRoutes');

const app = express();

app.use(cors({
    origin:['https://criptopass.onrender.com','http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
    credentials: true // Si usas cookies o headers de autenticación
    }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.set('port', process.env.PORT || 5000);

//const web3 = new Web3(process.env.LOCAL_GANACHE_RPC_URL);

app.use('/web3/signTx', signTxRoutes);
app.use('/web3/testUSDT', testRoutes);
app.use('/bridge/customers',bridgeCustomerRoutes);
app.use('/bridge/transfers',bridgeTransferRoutes);
app.use('/criptopass/auth',criptopassAuthRoutes);

app.get('/', (req,res)=>{
    res.json({message:'Welcome to Web3'});
});

app.listen(app.get('port'), ()=>{
    console.log('Server running on port: ', app.get('port'));
});
