import { Identity } from '@dfinity/agent';
import { getIcrcActor, getAuthActor } from './actors';
import { toNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';

export interface TokenInfo {
  canisterId: Principal;
  name: string;
  symbol: string;
  decimals: number;
}

// --- Module-level Cache ---
// MODIFIED: Use a Map to cache info for multiple tokens.
const tokenInfoCache = new Map<string, TokenInfo>();

// --- Helper Functions ---
const convertAmountToBigInt = (amount: number, decimals: number): bigint => {
  const [integer, fraction = ''] = String(amount).split('.');
  const paddedFraction = fraction.padEnd(decimals, '0');
  return BigInt(integer + paddedFraction);
};

const convertBigIntToAmount = (amount: bigint, decimals: number): number => {
  return Number(amount) / 10 ** decimals;
};

/**
 * Fetches the ICRC token's full info (name, symbol, decimals) from its metadata.
 * Implements a Map-based cache to avoid redundant calls for multiple tokens.
 */
export const getTokenInfo = async (
  identity: Identity,
  icrc2CanisterId: Principal,
): Promise<TokenInfo> => {
  const canisterIdText = icrc2CanisterId.toText();
  // MODIFIED: Check the Map for a cached entry.
  if (tokenInfoCache.has(canisterIdText)) {
    return tokenInfoCache.get(canisterIdText)!;
  }

  const icrcActor = getIcrcActor(identity, icrc2CanisterId);
  const metadata = await icrcActor.icrc1_metadata();

  const findMetaValue = (key: string): any => {
    const entry = metadata.find((m) => m[0] === key);
    return entry ? entry[1] : null;
  };

  const decimalsValue = findMetaValue('icrc1:decimals')?.Nat;
  const nameValue = findMetaValue('icrc1:name')?.Text;
  const symbolValue = findMetaValue('icrc1:symbol')?.Text;

  if (decimalsValue === undefined || !nameValue || !symbolValue) {
    throw new Error(
      'Required token metadata (name, symbol, decimals) not found.',
    );
  }

  const tokenInfo: TokenInfo = {
    canisterId: icrc2CanisterId,
    name: nameValue,
    symbol: symbolValue,
    decimals: Number(decimalsValue),
  };

  // MODIFIED: Store the result in the Map.
  tokenInfoCache.set(canisterIdText, tokenInfo);
  return tokenInfo;
};

/**
 * Calls the icrc2_approve method on the specified ledger canister.
 */
export const approveAllowance = async (
  identity: Identity,
  amount: number,
  spenderPrincipal: Principal,
  icrc2CanisterId: Principal,
) => {
  const icrcActor = getIcrcActor(identity, icrc2CanisterId);

  // --- THE FIX ---
  // MODIFIED: Dynamically fetch the decimals instead of hardcoding them.
  const { decimals } = await getTokenInfo(identity, icrc2CanisterId);
  const amountToApprove = convertAmountToBigInt(amount, decimals);

  const args = {
    spender: {
      owner: spenderPrincipal,
      subaccount: toNullable<Uint8Array>(),
    },
    amount: amountToApprove,
    fee: toNullable<bigint>(),
    memo: toNullable<Uint8Array>(),
    created_at_time: toNullable<bigint>(),
    from_subaccount: toNullable<Uint8Array>(),
    expected_allowance: toNullable<bigint>(),
    expires_at: toNullable<bigint>(),
  };

  const result = await icrcActor.icrc2_approve(args);

  if ('Err' in result) {
    throw new Error(Object.keys(result.Err)[0]);
  }

  return result.Ok;
};

/**
 * Notifies our backend that the payment setup is complete,
 * allowing the session state to be updated.
 */
export const completePaymentSetup = async (
  identity: Identity,
  sessionId: string,
) => {
  const authActor = getAuthActor(identity);
  const result = await authActor.complete_payment_setup(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }

  return result.ok;
};

/**
 * Fetches the user's ckUSDC balance from the ledger.
 */
export const getBalance = async (
  identity: Identity,
  icrc2CanisterId: Principal,
): Promise<number> => {
  const icrcActor = getIcrcActor(identity, icrc2CanisterId);
  const owner = identity.getPrincipal();
  const { decimals } = await getTokenInfo(identity, icrc2CanisterId);

  const balanceBigInt = await icrcActor.icrc1_balance_of({
    owner,
    subaccount: toNullable(),
  });

  return convertBigIntToAmount(balanceBigInt, decimals);
};

/**
 * Fetches the user's current ckUSDC allowance for a specific spender.
 */
export const getAllowance = async (
  identity: Identity,
  spender: Principal,
  icrc2CanisterId: Principal,
): Promise<number> => {
  const icrcActor = getIcrcActor(identity, icrc2CanisterId);
  const owner = identity.getPrincipal();
  const { decimals } = await getTokenInfo(identity, icrc2CanisterId);

  const result = await icrcActor.icrc2_allowance({
    account: { owner, subaccount: toNullable() },
    spender: { owner: spender, subaccount: toNullable() },
  });

  return convertBigIntToAmount(result.allowance, decimals);
};
