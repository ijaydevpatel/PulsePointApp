import { ApiClient, TokenProvider } from './apiClient';
import {
  RemoteSymptomAnalysis, RemoteMedicineCheck,
  RemoteChat, RemoteNews, RemoteDashboard, RemoteProfile,
} from './remoteServices';
import { OpenMeteoConditions } from './conditionsService';
import { OverpassFacilities } from './overpassFacilities';

export interface Services {
  readonly api: ApiClient;
  readonly symptoms: RemoteSymptomAnalysis;
  readonly medicines: RemoteMedicineCheck;

  readonly facilities: OverpassFacilities;
  readonly chat: RemoteChat;
  readonly news: RemoteNews;
  readonly dashboard: RemoteDashboard;
  readonly profile: RemoteProfile;

  readonly conditions: OpenMeteoConditions;
}

export function createServices(getToken: TokenProvider): Services {
  const api = new ApiClient();

  api.setTokenProvider(getToken);

  return {
    api,
    symptoms: new RemoteSymptomAnalysis(api),
    medicines: new RemoteMedicineCheck(api),
    facilities: new OverpassFacilities(),
    chat: new RemoteChat(api),
    news: new RemoteNews(api),
    dashboard: new RemoteDashboard(api),
    profile: new RemoteProfile(api),
    conditions: new OpenMeteoConditions(),
  };
}
