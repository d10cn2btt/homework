import { useEffect, useRef } from 'react';

const GROUP_GAP_MS = 5 * 60 * 1000; // 5 phút

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return formatTime(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(dateStr);
}

// Nhóm message theo sender + time gap
function groupMessages(messages) {
  const groups = [];
  let current = null;

  for (const msg of messages) {
    const isSystem = msg.type === 'SYSTEM';
    if (isSystem) {
      groups.push({ type: 'system', msg });
      current = null;
      continue;
    }

    const ts = new Date(msg.createdAt).getTime();
    const lastTs = current ? new Date(current.messages.at(-1).createdAt).getTime() : null;
    const sameUser = current && current.senderId === msg.senderId;
    const withinGap = lastTs && (ts - lastTs) < GROUP_GAP_MS;

    if (sameUser && withinGap) {
      current.messages.push(msg);
    } else {
      current = { type: 'group', senderId: msg.senderId, senderName: msg.senderName, messages: [msg] };
      groups.push(current);
    }
  }

  return groups;
}

// Border radius theo vị trí trong group
function bubbleRadius(isMe, index, total) {
  const base = 'rounded-2xl';
  if (total === 1) return base;
  if (isMe) {
    if (index === 0) return 'rounded-2xl rounded-br-md';
    if (index === total - 1) return 'rounded-2xl rounded-tr-md';
    return 'rounded-2xl rounded-r-md';
  } else {
    if (index === 0) return 'rounded-2xl rounded-bl-md';
    if (index === total - 1) return 'rounded-2xl rounded-tl-md';
    return 'rounded-2xl rounded-l-md';
  }
}

export default function MessageList({ messages, hasMore, onLoadMore, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const groups = groupMessages(sorted);

  let lastTimestamp = null;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-3 gap-0.5">
      {hasMore && (
        <button onClick={onLoadMore} className="self-center text-sm text-blue-600 hover:underline py-1 mb-2">
          Tải tin nhắn cũ hơn
        </button>
      )}

      {groups.map((group, gi) => {
        if (group.type === 'system') {
          return (
            <div key={gi} className="self-center text-xs text-gray-400 italic py-2">
              {group.msg.content}
            </div>
          );
        }

        const isMe = group.senderId === currentUserId;
        const firstTs = new Date(group.messages[0].createdAt).getTime();
        const showTimestamp = !lastTimestamp || (firstTs - lastTimestamp) >= GROUP_GAP_MS;
        lastTimestamp = new Date(group.messages.at(-1).createdAt).getTime();

        return (
          <div key={gi} className={`flex flex-col gap-0.5 mt-1 ${isMe ? 'items-end' : 'items-start'}`}>
            {showTimestamp && (
              <div className="self-center text-xs text-gray-400 py-2">
                {formatDateLabel(group.messages[0].createdAt)}
              </div>
            )}

            {!isMe && (
              <span className="text-xs font-medium text-gray-600 px-1 mb-0.5">
                {group.senderName}
              </span>
            )}

            {group.messages.map((msg, mi) => (
              <div
                key={msg.id}
                className={`max-w-[70%] px-3 py-2 text-sm whitespace-pre-wrap ${bubbleRadius(isMe, mi, group.messages.length)} ${
                  isMe
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
              </div>
            ))}

            <span className="text-xs text-gray-400 px-1">
              {formatTime(group.messages.at(-1).createdAt)}
            </span>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
