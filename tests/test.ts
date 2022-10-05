import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import { expect, use } from "chai";
import ChaiAsPromised from "chai-as-promised";
import { MarketplaceSdk } from "../packages/marketplace-sdk/src";
import {
  ExponentialCurveConfig,
  SplTokenBonding,
} from "../packages/spl-token-bonding/src";
import { TokenUtils } from "./utils/token";
import {
  createMint,
  SplTokenMetadata,
  createAtaAndMint,
} from "@strata-foundation/spl-utils";
import { DataV2 } from "@metaplex-foundation/mpl-token-metadata";
import { NATIVE_MINT } from "@solana/spl-token";
import { waitForUnixTime } from "./utils/clock";
import { SplTokenCollective } from "@strata-foundation/spl-token-collective";
import { AnchorProvider } from "@project-serum/anchor";
import { FungibleEntangler } from "@strata-foundation/fungible-entangler";

use(ChaiAsPromised);

function percent(percent: number): number {
  return Math.floor((percent / 100) * 4294967295); // uint32 max value
}

describe("marketplace-sdk", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.local("http://127.0.0.1:8899"));
  const provider = anchor.getProvider() as AnchorProvider;

  const program = anchor.workspace.SplTokenBonding;
  const tokenUtils = new TokenUtils(provider);
  const tokenBondingProgram = new SplTokenBonding(provider, program);
  const splTokenMetadata = new SplTokenMetadata({ provider });
  const fungibleEntangler = new FungibleEntangler(
    provider,
    anchor.workspace.FungibleEntangler
  );
  const tokenCollectiveProgram = new SplTokenCollective({
    provider,
    program,
    splTokenBondingProgram: tokenBondingProgram,
    splTokenMetadata,
  });
  const marketplaceSdk = new MarketplaceSdk(
    provider,
    tokenBondingProgram,
    tokenCollectiveProgram,
    fungibleEntangler,
    splTokenMetadata
  );
  const me = tokenBondingProgram.wallet.publicKey;

  before(async () => {
    await tokenBondingProgram.initializeSolStorage({
      mintKeypair: Keypair.generate(),
    });
  });

  it("allows creation of an lbc", async () => {
    const { targetMint, tokenBonding } =
      await marketplaceSdk.createLiquidityBootstrapper({
        iAmAFreeloader: true,
        authority: me,
        metadata: new DataV2({
          // Max name len 32
          name: "test",
          symbol: "test",
          uri: "",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        }),
        baseMint: NATIVE_MINT,
        startPrice: 2.5,
        minPrice: 0.5,
        interval: 60 * 60,
        maxSupply: 25,
        bondingArgs: {
          targetMintDecimals: 0,
        },
      });
    const tokenBondingAcct = (await tokenBondingProgram.getTokenBonding(
      tokenBonding
    ))!;
    await waitForUnixTime(
      provider.connection,
      BigInt(tokenBondingAcct.goLiveUnixTime.toNumber() + 2)
    );
    for (let i = 0; i < 25; i++) {
      console.log("BUYING TOKEN");
      await tokenBondingProgram.buy({
        tokenBonding,
        desiredTargetAmount: 1,
        slippage: 0.05,
        referralCode: "HELLO"
      });
    }
  });

  
});
