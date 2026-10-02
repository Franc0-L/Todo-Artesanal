export interface ClientTokenStatus {
  clientId: string;
  hasActiveToken: boolean;
}

export interface RotatedClientToken {
  clientId: string;
  token: string;
}
