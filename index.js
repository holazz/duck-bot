import 'dotenv/config'
import base58 from 'bs58'
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js'
import { Program, AnchorProvider, web3, Wallet } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import idl from './idl.json' assert { type: 'json' }

const PROGRAM_ID = new PublicKey('pvwX4B67eRRjBGQ4jJUtiUJEFQbR4bvG6Wbe6mkCjtt')
const MINT_ADDRESS = new PublicKey('4ALKS249vAS3WSCUxXtHJVZN753kZV6ucEQC41421Rka')
const CONFIG_ADDRESS = new PublicKey('B4cAqfPKtzsqm5mxDk4JkbvPPJoKyXNMyzj5X8SMfdQn')

async function mint(keypair) {
  const connection = new Connection(process.env.RPC_URL || 'https://cold-hanni-fast-mainnet.helius-rpc.com/', {
    confirmTransactionInitialTimeout: 100,
  })

  const wallet = new Wallet(keypair)

  const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions())
  const program = new Program(idl, provider)

  try {
    console.log('User address:', keypair.publicKey.toBase58())

    const userAta = await getAssociatedTokenAddress(MINT_ADDRESS, keypair.publicKey)

    const [userStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_state'), keypair.publicKey.toBuffer()],
      PROGRAM_ID
    )

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config'), CONFIG_ADDRESS.toBuffer()], PROGRAM_ID)

    const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority'), configPda.toBuffer()],
      PROGRAM_ID
    )

    const instruction = await program.methods
      .mintTokens()
      .accounts({
        mint: MINT_ADDRESS,
        config: configPda,
        userAta: userAta,
        userState: userStatePda,
        signer: keypair.publicKey,
        mintAuthority: mintAuthorityPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .instruction()

    const addPriorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: process.env.PRIORITY_FEE * 1e9 })

    const transaction = new Transaction().add(addPriorityFeeIx).add(instruction)

    transaction.feePayer = keypair.publicKey
    transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash

    console.log('Sending transaction...')
    const signature = await provider.sendAndConfirm(transaction)
    console.log('Transaction signature:', signature)
    console.log('Mint Success')
  } catch (e) {
    // console.log(e)
  }
}

async function run() {
  const keypair = Keypair.fromSecretKey(base58.decode(process.env.PRIVATE_KEY))
  await mint(keypair)
}

while (true) {
  await run()
}
