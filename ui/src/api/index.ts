// Re-export all types and the factory from generated client
export * from './client';
export { getSimpleSSENotificationAPI } from './client';

// Extract and re-export individual API functions for convenience
import { getSimpleSSENotificationAPI } from './client';

const api = getSimpleSSENotificationAPI();
export const {
  postLogin,
  postLogout,
  getEvents,
  postNotify,
  getUsers,
  postAcknowledgeRequest,
  postAcknowledgeResponse,
} = api;
