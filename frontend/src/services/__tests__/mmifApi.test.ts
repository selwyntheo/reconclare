import {
  runMmifAgentAnalysis,
  fetchMmifAgentAnalysis,
  fetchMmifAttestation,
  createMmifChatSession,
  sendMmifChatMessage,
  fetchMmifChatHistory,
} from '../api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  });
});

describe('MMIF API Functions', () => {
  describe('runMmifAgentAnalysis', () => {
    it('calls POST /api/mmif/events/{eventId}/analyze', async () => {
      await runMmifAgentAnalysis('EVT-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif/events/EVT-001/analyze'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('fetchMmifAgentAnalysis', () => {
    it('calls GET /api/mmif/events/{eventId}/agent-analysis', async () => {
      await fetchMmifAgentAnalysis('EVT-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif/events/EVT-001/agent-analysis'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });

    it('returns parsed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ eventId: 'EVT-001', phase: 'COMPLETED' }),
      });
      const result = await fetchMmifAgentAnalysis('EVT-001');
      expect(result).toEqual({ eventId: 'EVT-001', phase: 'COMPLETED' });
    });
  });

  describe('fetchMmifAttestation', () => {
    it('calls GET /api/mmif/events/{eventId}/attestation', async () => {
      await fetchMmifAttestation('EVT-002');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif/events/EVT-002/attestation'),
        expect.anything(),
      );
    });
  });

  describe('createMmifChatSession', () => {
    it('calls POST /api/mmif-chat/session with eventId body', async () => {
      await createMmifChatSession('EVT-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif-chat/session'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ eventId: 'EVT-001' }),
        }),
      );
    });
  });

  describe('sendMmifChatMessage', () => {
    it('calls POST /api/mmif-chat/session/{sessionId}/message with message body', async () => {
      await sendMmifChatMessage('SESS-001', 'Hello');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif-chat/session/SESS-001/message'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Hello' }),
        }),
      );
    });
  });

  describe('fetchMmifChatHistory', () => {
    it('calls GET /api/mmif-chat/session/{sessionId}/history', async () => {
      await fetchMmifChatHistory('SESS-001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mmif-chat/session/SESS-001/history'),
        expect.anything(),
      );
    });

    it('returns chat history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          sessionId: 'SESS-001',
          messages: [{ role: 'user', content: 'Hi', timestamp: '2025-01-01' }],
        }),
      });
      const result = await fetchMmifChatHistory('SESS-001');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });
  });
});
