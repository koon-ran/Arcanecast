"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { getMXEPublicKey, RescueCipher, x25519 } from "@arcium-hq/client";
import { ArciumContextType } from "@/types";
import { VOTING_PROGRAM_ID } from "@/config/constants";
import toast from "react-hot-toast";

const ArciumContext = createContext<ArciumContextType | null>(null);

export function ArciumProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [isReady, setIsReady] = useState(false);
  const [mxePublicKey, setMxePublicKey] = useState<Uint8Array | null>(null);
  const [clientPrivateKey, setClientPrivateKey] = useState<Uint8Array | null>(
    null
  );
  const [clientPublicKey, setClientPublicKey] = useState<Uint8Array | null>(
    null
  );
  const [cipher, setCipher] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialize = async () => {
    if (!wallet) {
      setError("Wallet not connected");
      return;
    }

    try {
      setIsReady(false);
      setError(null);
      toast.loading("Initializing Arcium encryption...", { id: "arcium-init" });

      // Fetch MXE public key with retry
      console.log("Fetching MXE public key...");
      const mxePubKey = await getMXEPublicKeyWithRetry(connection, wallet);
      console.log("MXE public key fetched:", mxePubKey);
      setMxePublicKey(mxePubKey);

      // Generate ephemeral client keypair
      console.log("Generating client keypair...");
      const clientPrivKey = x25519.utils.randomSecretKey();
      const clientPubKey = x25519.getPublicKey(clientPrivKey);
      setClientPrivateKey(clientPrivKey);
      setClientPublicKey(clientPubKey);

      // Perform ECDH key exchange
      console.log("Performing key exchange...");
      const sharedSecret = x25519.getSharedSecret(clientPrivKey, mxePubKey);

      // Initialize Rescue cipher
      console.log("Initializing cipher...");
      const rescueCipher = new RescueCipher(sharedSecret);
      setCipher(rescueCipher);

      setIsReady(true);
      toast.success("Encryption ready!", { id: "arcium-init" });
    } catch (err: any) {
      console.error("Failed to initialize Arcium:", err);
      const errorMsg = err?.message || "Failed to initialize encryption";
      setError(errorMsg);
      toast.error(errorMsg, { id: "arcium-init" });
    }
  };

  useEffect(() => {
    if (wallet) {
      initialize();
    } else {
      setIsReady(false);
      setMxePublicKey(null);
      setClientPrivateKey(null);
      setClientPublicKey(null);
      setCipher(null);
      setError(null);
    }
  }, [wallet]);

  const value: ArciumContextType = {
    isReady,
    mxePublicKey,
    clientPrivateKey,
    clientPublicKey,
    cipher,
    error,
    initialize,
  };

  return (
    <ArciumContext.Provider value={value}>{children}</ArciumContext.Provider>
  );
}

export function useArcium() {
  const context = useContext(ArciumContext);
  if (!context) {
    throw new Error("useArcium must be used within ArciumProvider");
  }
  return context;
}

// Helper function to fetch MXE public key with retry
async function getMXEPublicKeyWithRetry(
  connection: any,
  wallet: any,
  maxRetries: number = 10,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a proper AnchorProvider instance
      const { AnchorProvider } = await import("@coral-xyz/anchor");
      const provider = new AnchorProvider(
        connection,
        wallet,
        { commitment: "confirmed" }
      );

      const mxePublicKey = await getMXEPublicKey(provider, VOTING_PROGRAM_ID);
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
      console.log(`Attempt ${attempt} failed to fetch MXE public key:`, error);
    }

    if (attempt < maxRetries) {
      console.log(
        `Retrying in ${retryDelayMs}ms... (attempt ${attempt}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Failed to fetch MXE public key after ${maxRetries} attempts`);
}
