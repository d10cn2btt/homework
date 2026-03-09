import { useEffect, useRef } from 'react';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, hasMore, onLoadMore }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-2 gap-2">
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="self-center text-sm text-blue-600 hover:underline py-1"
        >
          Tải tin nhắn cũ hơn
        </button>
      )}

      {sorted.map((msg) => (
        <div key={msg.id} className="flex flex-col max-w-xl">
          <span className="text-xs text-gray-500 mb-0.5">
            <span className="font-medium text-gray-700">{msg.senderName}</span>{' '}
            · {formatTime(msg.createdAt)}
          </span>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
