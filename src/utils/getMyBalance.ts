import { ethers } from 'ethers';
import { ENV } from '../config/env';

const RPC_URL = ENV.RPC_URL;
const USDC_CONTRACT_ADDRESS = ENV.USDC_CONTRACT_ADDRESS;
const NETWORK_RETRY_LIMIT = ENV.NETWORK_RETRY_LIMIT;

const USDC_ABI = ['function balanceOf(address owner) view returns (uint256)'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getMyBalance = async (address: string): Promise<number> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= NETWORK_RETRY_LIMIT; attempt++) {
        try {
            const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
            const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
            const balance_usdc = await usdcContract.balanceOf(address);
            const balance_usdc_real = ethers.utils.formatUnits(balance_usdc, 6);
            return parseFloat(balance_usdc_real);
        } catch (error) {
            lastError = error;

            if (attempt < NETWORK_RETRY_LIMIT) {
                await sleep(500 * attempt);
                continue;
            }
        }
    }

    throw new Error(
        `Failed to fetch USDC balance for ${address}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
};

export default getMyBalance;
