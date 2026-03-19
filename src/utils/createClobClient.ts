import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { ENV } from '../config/env';
import Logger from './logger';
import { resolvePolymarketClientConfig } from './polymarketClientConfig';

const CLOB_HTTP_URL = ENV.CLOB_HTTP_URL;
const RPC_URL = ENV.RPC_URL;

const createClobClient = async (): Promise<ClobClient> => {
    const chainId = 137;
    const host = CLOB_HTTP_URL as string;
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const { wallet, signatureType, signatureTypeLabel, funderAddress } =
        resolvePolymarketClientConfig(provider);

    Logger.info(`Polymarket signature mode: ${signatureTypeLabel}`);

    let clobClient = new ClobClient(host, chainId, wallet, undefined, signatureType, funderAddress);

    // Suppress console output during API key creation
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = function () {};
    console.error = function () {};

    let creds = await clobClient.createApiKey();
    if (!creds.key) {
        creds = await clobClient.deriveApiKey();
    }

    clobClient = new ClobClient(host, chainId, wallet, creds, signatureType, funderAddress);

    // Restore console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    return clobClient;
};

export default createClobClient;
