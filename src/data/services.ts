/**
 * One place where the API client and every remote service are built, and the
 * only place the auth token is bound to the transport.
 *
 * Why a container rather than constructing services inside each screen: the
 * token provider has to be attached exactly once, to exactly one ApiClient. If
 * screens built their own clients, some would have a token and some would not,
 * and the resulting 401s would look intermittent rather than structural.
 */
import { ApiClient, TokenProvider } from './apiClient';
import {
  RemoteSymptomAnalysis, RemoteMedicineCheck,
  RemoteChat, RemoteNews, RemoteDashboard, RemoteProfile,
} from './remoteServices';
import { OpenMeteoConditions } from './conditionsService';

export interface Services {
  readonly api: ApiClient;
  readonly symptoms: RemoteSymptomAnalysis;
  readonly medicines: RemoteMedicineCheck;
  readonly chat: RemoteChat;
  readonly news: RemoteNews;
  readonly dashboard: RemoteDashboard;
  readonly profile: RemoteProfile;
  /**
   * Not built on the ApiClient: conditions come from Open-Meteo directly
   * rather than from our backend, whose values for them are hard-coded. It
   * needs no token, so it needs nothing from the container except a place to
   * live beside the others.
   */
  readonly conditions: OpenMeteoConditions;
}

/**
 * @param getToken Clerk's own getToken from useAuth(). Passed in rather than
 *   imported so this file stays testable and Clerk stays confined to the UI
 *   root - the services themselves never learn which identity provider is in
 *   use.
 */
export function createServices(getToken: TokenProvider): Services {
  const api = new ApiClient();
  // Read the token per request rather than caching it: Clerk rotates short-
  // lived tokens, so a value captured at startup would be stale by the time
  // the user actually asks for an analysis.
  api.setTokenProvider(getToken);

  return {
    api,
    symptoms: new RemoteSymptomAnalysis(api),
    medicines: new RemoteMedicineCheck(api),
    chat: new RemoteChat(api),
    news: new RemoteNews(api),
    dashboard: new RemoteDashboard(api),
    profile: new RemoteProfile(api),
    conditions: new OpenMeteoConditions(),
  };
}
