const { Connection, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { getMXEPublicKey } = require('@arcium-hq/client');

async function testMXEFetch() {
  const connection = new Connection('https://devnet.helius-rpc.com/?api-key=98664a07-fdde-46f8-ac7d-7efd848339c4', 'confirmed');
  const VOTING_PROGRAM_ID = new PublicKey('665esySAfjG6KFU7oGMEZNHbnK17xh92LCiXmxoUhzv8');
  
  // Create a dummy wallet (we don't need to sign anything)
  const dummyKeypair = {
    publicKey: PublicKey.default,
    secretKey: new Uint8Array(64)
  };
  const wallet = new Wallet(dummyKeypair);
  
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  );
  
  console.log('Testing getMXEPublicKey...');
  console.log('Program ID:', VOTING_PROGRAM_ID.toString());
  console.log('RPC:', connection.rpcEndpoint);
  console.log('Cluster Offset: 1078779259');
  
  try {
    const mxePublicKey = await getMXEPublicKey(provider, VOTING_PROGRAM_ID);
    if (mxePublicKey === null || mxePublicKey === undefined) {
      console.error('❌ getMXEPublicKey returned null/undefined');
      console.log('This means the MXE account exists but the data format is not recognized');
    } else {
      console.log('✅ SUCCESS! MXE public key:', Buffer.from(mxePublicKey).toString('hex'));
      console.log('Length:', mxePublicKey.length, 'bytes');
    }
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Full error:', error);
  }
}

testMXEFetch();
