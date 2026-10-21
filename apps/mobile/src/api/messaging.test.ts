import { createMessagingApi } from './messaging';
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
function setup(data: unknown) {
  const fetchImplementation = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(new Response(JSON.stringify({ data, requestId: id })));
  return {
    fetchImplementation,
    api: createMessagingApi({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => Promise.resolve('test-token'),
      fetchImplementation,
    }),
  };
}
describe('message interaction client boundaries', () => {
  it('uses desired-state PUT without supplying actor identity', async () => {
    const { api, fetchImplementation } = setup({
      messageId: id,
      revision: 1,
      replyTo: null,
      reactions: [],
    });
    await api.setReaction(other, id, { reaction: 'HEART', expectedRevision: 0 });
    expect(fetchImplementation).toHaveBeenCalledWith(
      `https://api.example.test/v1/conversations/${other}/messages/${id}/reaction`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ reaction: 'HEART', expectedRevision: 0 }),
      }),
    );
  });
  it('rejects a context ACK for a different message', async () => {
    const { api } = setup({ messageId: other, revision: 1, replyTo: null, reactions: [] });
    await expect(
      api.setReaction(other, id, { reaction: null, expectedRevision: 1 }),
    ).rejects.toThrow('unexpected response');
  });
  it('bounds context batches before issuing a request', async () => {
    const { api, fetchImplementation } = setup([]);
    await expect(
      api.contexts(
        id,
        Array.from({ length: 51 }, () => id),
      ),
    ).rejects.toThrow();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
