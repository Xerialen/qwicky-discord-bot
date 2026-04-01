const { handleAnnouncement } = require('../services/handlers/announcement');

describe('handleAnnouncement', () => {
  let client;
  let mockChannel;

  beforeEach(() => {
    mockChannel = { send: vi.fn().mockResolvedValue({}) };
    client = {
      channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
    };
  });

  it('sends message to the correct channel', async () => {
    const notification = {
      channel_id: 'chan123',
      payload: { content: 'Tournament starts now!' },
    };
    await handleAnnouncement(client, notification);
    expect(client.channels.fetch).toHaveBeenCalledWith('chan123');
    expect(mockChannel.send).toHaveBeenCalledWith({
      content: 'Tournament starts now!',
      allowedMentions: { parse: [] },
    });
  });

  it('throws when payload has no content', async () => {
    const notification = { channel_id: 'chan123', payload: {} };
    await expect(handleAnnouncement(client, notification)).rejects.toThrow(
      'Announcement payload missing content'
    );
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('throws when channel is not found', async () => {
    client.channels.fetch.mockResolvedValue(null);
    const notification = { channel_id: 'chan123', payload: { content: 'hello' } };
    await expect(handleAnnouncement(client, notification)).rejects.toThrow(
      'Channel chan123 not found'
    );
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  it('enforces allowedMentions parse: [] to prevent mass pings', async () => {
    const notification = {
      channel_id: 'chan123',
      payload: { content: '@everyone free stuff!' },
    };
    await handleAnnouncement(client, notification);
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ allowedMentions: { parse: [] } })
    );
  });
});
