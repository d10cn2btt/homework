import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import { listRooms, createRoom, joinRoom, leaveRoom, renameRoom, deleteRoom, getMessages } from '../api/chat.api';
import RoomList from '../components/chat/RoomList';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import { API_ERR, WS_ERROR, WS_STATUS } from '../constants/index.js';

const ERROR_MESSAGES = {
  [API_ERR.VALIDATION_ERROR]:     'Dữ liệu không hợp lệ.',
  [API_ERR.ROOM_NOT_FOUND]:       'Room không tồn tại.',
  [API_ERR.FORBIDDEN]:            'Bạn không có quyền thực hiện thao tác này.',
  [API_ERR.ALREADY_MEMBER]:       'Bạn đã là thành viên của room này.',
  [API_ERR.NOT_MEMBER]:           'Bạn không phải thành viên của room này.',
  [API_ERR.CREATOR_CANNOT_LEAVE]: 'Người tạo room không thể rời khi còn thành viên khác.',
  [API_ERR.USER_NOT_FOUND]:       'Không tìm thấy người dùng.',
  [WS_ERROR.DELIVER_FAILED]:      'Tin nhắn không gửi được đến một số thành viên.',
  [WS_ERROR.INVALID_PAYLOAD]:     'Tin nhắn không hợp lệ.',
  [WS_ERROR.INTERNAL_ERROR]:      'Lỗi server, vui lòng thử lại.',
};

function getErrorMessage(err) {
  const code = err?.response?.data?.message;
  return ERROR_MESSAGES[code] ?? err?.response?.data?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.';
}

export default function ChatPage() {
  const { currentUser } = useAuth();
  const { messages: realtimeMessages, sendMessage, status, reconnectedAt, lastWsError } = useWebSocket();

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState(null);

  // Auto-dismiss error sau 4 giây
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Show WS error frames
  useEffect(() => {
    if (!lastWsError) return;
    setError(ERROR_MESSAGES[lastWsError.code] ?? 'Lỗi kết nối.');
  }, [lastWsError]);

  // Fetch missed messages sau khi WS reconnect
  useEffect(() => {
    if (!reconnectedAt || !selectedRoomId) return;
    getMessages(selectedRoomId, { since: reconnectedAt })
      .then(({ messages }) => {
        if (messages.length === 0) return;
        setHistoryMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = messages.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newMsgs];
        });
      })
      .catch(() => {});
  }, [reconnectedAt, selectedRoomId]);

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
      setRooms((prev) => [...prev, room]);
      setSelectedRoomId(room.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const handleJoin = useCallback(async (roomId) => {
    try {
      await joinRoom(roomId);
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, isMember: true } : r));
      setSelectedRoomId(roomId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const handleLeave = useCallback(async () => {
    if (!selectedRoomId) return;
    try {
      await leaveRoom(selectedRoomId);
      setRooms((prev) => prev.map((r) => r.id === selectedRoomId ? { ...r, isMember: false } : r));
      setSelectedRoomId(null);
      setHistoryMessages([]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [selectedRoomId]);

  const handleRenameSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !selectedRoomId) return;
    try {
      const updated = await renameRoom(selectedRoomId, renameValue.trim());
      setRooms((prev) => prev.map((r) => r.id === selectedRoomId ? { ...r, name: updated.name } : r));
      setRenaming(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [selectedRoomId, renameValue]);

  const handleDelete = useCallback(async () => {
    if (!selectedRoomId || !confirm('Xóa room này?')) return;
    try {
      await deleteRoom(selectedRoomId);
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoomId));
      setSelectedRoomId(null);
      setHistoryMessages([]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [selectedRoomId]);

  const handleSend = useCallback(
    (content) => {
      if (selectedRoomId) sendMessage(selectedRoomId, content);
    },
    [selectedRoomId, sendMessage]
  );

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const realtimeForRoom = realtimeMessages
    .filter((m) => m.data?.roomId === selectedRoomId)
    .map((m) => m.data);

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
        onJoin={handleJoin}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {error && (
          <div
            className="mx-4 mt-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 cursor-pointer"
            onClick={() => setError(null)}
          >
            {error}
          </div>
        )}

        {selectedRoomId ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
              {renaming ? (
                <form onSubmit={handleRenameSubmit} className="flex gap-2 flex-1">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="border rounded px-2 py-0.5 text-sm flex-1"
                    autoFocus
                  />
                  <button type="submit" className="text-xs bg-blue-600 text-white rounded px-2 py-0.5">Lưu</button>
                  <button type="button" onClick={() => setRenaming(false)} className="text-xs text-gray-500">Hủy</button>
                </form>
              ) : (
                <span className="font-medium text-sm text-gray-800">{selectedRoom?.name}</span>
              )}

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-xs text-gray-400">
                  WS: <span className={status === 'open' ? 'text-green-600' : 'text-red-500'}>{status}</span>
                </span>
                {selectedRoom?.isOwner && !renaming && (
                  <button
                    onClick={() => { setRenameValue(selectedRoom.name); setRenaming(true); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Đổi tên
                  </button>
                )}
                {selectedRoom?.isOwner && (
                  <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-700">
                    Xóa room
                  </button>
                )}
                {!selectedRoom?.isOwner && (
                  <button onClick={handleLeave} className="text-xs text-gray-500 hover:text-red-500">
                    Rời room
                  </button>
                )}
              </div>
            </div>
            <MessageList messages={allMessages} hasMore={hasMore} onLoadMore={handleLoadMore} currentUserId={currentUser?.id} />
            <MessageInput onSend={handleSend} disabled={status !== WS_STATUS.OPEN} />
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
