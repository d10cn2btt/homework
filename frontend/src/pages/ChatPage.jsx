import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { listRooms, createRoom, getMessages } from '../api/chat.api';
import RoomList from '../components/chat/RoomList';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

export default function ChatPage() {
  const { messages: realtimeMessages, sendMessage, status } = useWebSocket();

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    listRooms().then(setRooms).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;
    setHistoryMessages([]);
    setNextCursor(null);
    setHasMore(false);
    getMessages(selectedRoomId)
      .then(({ messages, nextCursor: cursor }) => {
        setHistoryMessages(messages);
        setNextCursor(cursor);
        setHasMore(cursor !== null);
      })
      .catch(() => {});
  }, [selectedRoomId]);

  const handleLoadMore = useCallback(() => {
    if (!selectedRoomId || !nextCursor) return;
    getMessages(selectedRoomId, { before: nextCursor })
      .then(({ messages, nextCursor: cursor }) => {
        setHistoryMessages((prev) => [...messages, ...prev]);
        setNextCursor(cursor);
        setHasMore(cursor !== null);
      })
      .catch(() => {});
  }, [selectedRoomId, nextCursor]);

  const handleCreateRoom = useCallback(async (name) => {
    try {
      const room = await createRoom(name);
      setRooms((prev) => [...prev, { ...room, lastMessage: null }]);
      setSelectedRoomId(room.id);
    } catch {
      // ignore
    }
  }, []);

  const handleSend = useCallback(
    (content) => {
      if (selectedRoomId) sendMessage(selectedRoomId, content);
    },
    [selectedRoomId, sendMessage]
  );

  const realtimeForRoom = realtimeMessages.filter((m) => m.roomId === selectedRoomId);

  const allMessages = (() => {
    const seen = new Set();
    return [...historyMessages, ...realtimeForRoom].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })();

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <RoomList
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelect={setSelectedRoomId}
        onCreate={handleCreateRoom}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {selectedRoomId ? (
          <>
            <div className="px-4 py-2 border-b border-gray-200 bg-white text-sm text-gray-500">
              WS: <span className={status === 'open' ? 'text-green-600' : 'text-red-500'}>{status}</span>
            </div>
            <MessageList messages={allMessages} hasMore={hasMore} onLoadMore={handleLoadMore} />
            <MessageInput onSend={handleSend} disabled={status !== 'open'} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Chọn một room để bắt đầu chat
          </div>
        )}
      </div>
    </div>
  );
}
