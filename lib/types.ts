export interface SubtitlesResult {
  srt: string;
  title: string;
}

export interface ApiRequest {
  url: string;
}

export interface ApiSuccessResponse {
  srt: string;
  title: string;
}

export interface ApiErrorResponse {
  error: string;
}
