import { Identity } from '@dfinity/agent';
import { getAuthActor } from './actors';
import { Principal } from '@dfinity/principal';

// --- Type Definitions ---
// It's good practice to define the expected return types.
// These should match the types in your oauth_backend.did.js file.

interface ScopeDetails {
  id: string;
  description: string;
}

interface ConsentData {
  client_name: string;
  logo_uri: string;
  scopes: ScopeDetails[];
}

interface ConfirmLoginOk {
  next_step: { setup: null } | { consent: null };
  consent_data: ConsentData;
  accepted_payment_canisters: Principal[];
}

interface SessionInfo {
  client_name: string;
  resource_server_principal: Principal;
}

// --- API Functions ---

/**
 * Called after a user logs in to check the required scopes and determine the next step.
 */
export const confirmLogin = async (
  identity: Identity,
  sessionId: string,
): Promise<ConfirmLoginOk> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.confirm_login(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Fetches information about the current session, including the resource server principal.
 */
export const getSessionInfo = async (
  identity: Identity,
  sessionId: string,
): Promise<SessionInfo> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.get_session_info(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Called after a user successfully approves an ICRC-2 allowance.
 */
export const completePaymentSetup = async (
  identity: Identity,
  sessionId: string,
): Promise<void> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.complete_payment_setup(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return;
};

/**
 * Called when the user clicks "Allow" on the consent screen.
 * This finalizes the authorization flow and generates the authorization code.
 * @returns The final redirect URL to send the user back to the client application.
 */
export const completeAuthorize = async (
  identity: Identity,
  sessionId: string,
): Promise<string> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.complete_authorize(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Called when the user clicks "Deny" on the consent screen.
 * This cancels the authorization flow and cleans up the session on the backend.
 * @returns The final redirect URL (with error params) to send the user back to the client.
 */
export const denyConsent = async (
  identity: Identity,
  sessionId: string,
): Promise<string> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.deny_consent(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * A utility function to get the principal of the OAuth backend canister itself.
 * This is no longer needed by the payment API but can be useful for debugging.
 */
export const getOwnPrincipal = (identity: Identity): Principal => {
  return identity.getPrincipal();
};
