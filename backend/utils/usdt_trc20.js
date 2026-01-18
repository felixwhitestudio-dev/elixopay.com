require('dotenv').config();
const TronWeb = require('tronweb').TronWeb || require('tronweb');

const tronWeb = new TronWeb({
  fullHost: process.env.TRON_NODE || 'https://api.trongrid.io',
  privateKey: process.env.TRON_PRIVATE_KEY
});

const USDT_CONTRACT = process.env.USDT_CONTRACT_TRC20; // USDT TRC20 contract

async function sendUSDT_TRON(toAddress, amountUSDT) {
  // USDT TRC20 มี 6 decimal
  const amount = (amountUSDT * 1e6).toString();

  // ตรวจสอบยอดคงเหลือ
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const balance = await contract.balanceOf(tronWeb.defaultAddress.base58).call();
  if (parseInt(balance) < amount) throw new Error('Insufficient USDT balance in hot wallet');

  // ส่ง USDT
  const tx = await contract.transfer(toAddress, amount).send();
  console.log('Tx sent:', tx);
  return tx;
}

module.exports = { sendUSDT_TRON };
