import { ethers } from 'ethers';
import { SignatureType } from '@polymarket/order-utils';
import { ENV } from '../config/env';

const SIGNATURE_TYPE_LABELS: Record<SignatureType, string> = {
    [SignatureType.EOA]: 'EOA',
    [SignatureType.POLY_PROXY]: 'POLY_PROXY',
    [SignatureType.POLY_GNOSIS_SAFE]: 'POLY_GNOSIS_SAFE',
};

const resolveExplicitSignatureType = (value?: string): SignatureType | undefined => {
    if (!value || value.toUpperCase() === 'AUTO') {
        return undefined;
    }

    switch (value.toUpperCase()) {
        case 'EOA':
            return SignatureType.EOA;
        case 'POLY_PROXY':
            return SignatureType.POLY_PROXY;
        case 'POLY_GNOSIS_SAFE':
            return SignatureType.POLY_GNOSIS_SAFE;
        default:
            throw new Error(`Unsupported CLOB_SIGNATURE_TYPE: ${value}`);
    }
};

export interface PolymarketClientConfig {
    wallet: ethers.Wallet;
    signatureType: SignatureType;
    signatureTypeLabel: string;
    funderAddress?: string;
}

export const resolvePolymarketClientConfig = (
    provider?: ethers.providers.Provider
): PolymarketClientConfig => {
    const wallet = provider
        ? new ethers.Wallet(ENV.PRIVATE_KEY as string, provider)
        : new ethers.Wallet(ENV.PRIVATE_KEY as string);
    const signerAddress = wallet.address.toLowerCase();
    const funderAddress = ENV.PROXY_WALLET as string;
    const usesSeparateFunder = signerAddress !== funderAddress.toLowerCase();
    const explicitSignatureType = resolveExplicitSignatureType(ENV.CLOB_SIGNATURE_TYPE);

    const signatureType =
        explicitSignatureType ??
        (usesSeparateFunder ? SignatureType.POLY_PROXY : SignatureType.EOA);

    return {
        wallet,
        signatureType,
        signatureTypeLabel: SIGNATURE_TYPE_LABELS[signatureType],
        funderAddress: usesSeparateFunder ? funderAddress : undefined,
    };
};